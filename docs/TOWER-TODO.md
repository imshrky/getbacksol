# Chantiers à faire sur la tour PC (boucle de test locale)

These two features can't be built/verified in the assistant's Mac environment
(no Node to install the SDKs, no way to sign mainnet transactions, can't run
the code). They handle real funds and are complex, so they need a **fast local
dev loop**: run the repo on the tower (`npm install && npm run dev`), debug on
**devnet** first (free SOL), then flip to mainnet once verified.

When resuming with Claude on the tower, start by reading this file.

---

## 1. Native Raydium liquidity pool creation — BUILT, gated off (2026-08-07)

Status: implemented, **not yet enabled**. Full plan, cost model and steps in
**`docs/RAYDIUM-POOL-TODO.md`** (kept for reference — the implementation
below follows it). `@raydium-io/raydium-sdk-v2` installed; new
`src/lib/raydiumPool.ts` (shared constants: program IDs per network, the
Standard CPMM fee config, our flat 0.1 SOL commission), `src/lib/useCreatePool.ts`
(client hook, same fully-client-built-and-signed pattern as
`useCreateToken.ts` — no relay, the creator pays for everything from their
own wallet since they're the one providing liquidity), and
`src/app/create-liquidity/page.tsx` rewritten from the old mock UI to a real
one (token mint input with live symbol lookup via `/api/token-meta`, amount
inputs, real cost breakdown). Token Creator's "Add liquidity" card now links
to `/create-liquidity?mint=<address>` once the switch below is on, external
Raydium link otherwise (unchanged safe interim).

**Gated off by default** via `NEXT_PUBLIC_RAYDIUM_POOL_LIVE` (must be
explicitly set to `"true"` on Vercel — the opposite default from the Token
Creator's kill-switch, deliberately, since this moves a creator's real
liquidity irreversibly). Do not flip it on without real-wallet testing first.

Verified: read the SDK's actual (non-minified-guessed) `createPool`
implementation to confirm CPMM pool/vault/LP-mint/observation accounts are
all PDAs — no extra ephemeral keypair needs to co-sign, unlike token
creation's fresh mint account. Confirmed live against Raydium's real API:
19 CPMM fee configs exist, index 0 (`D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2`,
0.25% trade fee) is the "Standard" tier Raydium's own UI defaults to, and its
real `createPoolFee` is 150,000,000 lamports (0.15 SOL) — the number now
shown in the UI's cost preview. tsc and `npm run build` both clean; the page
loads in the browser with no console/network errors, the kill-switch
correctly disables the button by default, and the `?mint=` prefill from
Token Creator works.

**Not verified**: an actual `createPool()` call, even build-only. Unlike
Sell (where Jupiter's API doesn't check any wallet's real holdings), Raydium's
SDK reads the owner's *actual* on-chain token balance before it will build
anything — tested this directly with a dummy keypair and confirmed the SDK
correctly refuses ("you don't has some token account") when the wallet holds
nothing, which is exactly the right behavior for production, but it means a
genuine dry run needs a real wallet that actually holds a real SPL token
balance, which wasn't available in this environment. **Test this for real
before enabling**: create a token, revoke freeze, come here with a real
wallet, tiny amounts (see docs/RAYDIUM-POOL-TODO.md's original test plan —
devnet first, then mainnet with amounts you can afford to lose), decode the
built transaction instruction-by-instruction before trusting it, exactly the
same discipline used for Sell and the original burn/close path.

---

## 2. Fix the Sell-dust flow — FIXED (2026-08-07)

Status: done. `jupiter.ts` / `build-sell` / `relay-close` / `useReclaimRent.ts`
now build and validate a real v0 transaction with ALTs. Verified structurally
against the real Jupiter API + real mainnet RPC (no funds moved, build-only):
a real USDC→SOL route needed 3 ALTs, compiled to **1052 bytes** (under the
1232 limit) — the equivalent legacy transaction would have been **1630
bytes**, confirming both the original diagnosis and the fix. Not yet tested
signed-and-submitted with a real dust account in the live UI — do that before
fully trusting it (decode the tx instruction-by-instruction first, per the
original test plan below).

One correction to the diagnosis: Jupiter's `/swap/v2/build` response does
**not** have an `addressLookupTableAddresses` field — it's
`addressesByLookupTableAddress` (an object keyed by table address). Confirmed
against a live response before relying on it; the original diagnosis assumed
the wrong field name, which would have silently no-opped the whole fix.

Original diagnosis kept below for reference.

### Files involved
- `src/lib/jupiter.ts` — fetches the Jupiter route
- `src/app/api/build-sell/route.ts` — builds the sell transaction
- `src/app/api/relay-close/route.ts` — validates + co-signs + submits
- `src/lib/useReclaimRent.ts` — `trySell()` on the client

### Root cause: legacy transaction, no address lookup tables
Jupiter swaps **require a versioned (v0) transaction with address lookup
tables (ALTs)** — the ALTs compress the 30-40+ accounts a swap references.

Current code:
- `jupiter.ts` **never reads** the `addressLookupTableAddresses` Jupiter
  returns — they're dropped.
- `build-sell` builds a **`new Transaction()` (legacy)**, which can't use ALTs.

Cascade: without ALTs, every account must fit inline in the tx → real swaps
blow past the **1232-byte legacy limit** → the `MAX_LEGACY_TX_BYTES` guard
returns "Sell route too complex" (400) → the client falls back to burn. Only
trivial routes ever squeak through.

(The Jupiter endpoint itself — `https://api.jup.ag/swap/v2/build` — is correct.)

### Fix (v0 + ALTs across the whole path)
1. `jupiter.ts` — also read `data.addressLookupTableAddresses` and return them
   in `SellRoute`. Fetch the ALT accounts (`connection.getAddressLookupTable`).
2. `build-sell` — build a `VersionedTransaction`:
   `new VersionedTransaction(new TransactionMessage({ payerKey, recentBlockhash, instructions }).compileToV0Message(lookupTableAccounts))`.
   Keep the same fee/close/payout instructions appended.
3. `relay-close` — its validation reads legacy shape (`Transaction.from`,
   `tx.instructions`, `tx.signatures`). Adapt to v0: `VersionedTransaction.deserialize`,
   iterate `message.compiledInstructions` (map programIdIndex/accountKeyIndexes
   via `message.staticAccountKeys` + resolved ALTs), and co-sign with
   `tx.sign([feePayer])`. Keep the same allow-list + caps logic, just on v0.
4. `useReclaimRent.ts` `trySell()` — deserialize with
   `VersionedTransaction.deserialize`, sign via wallet-adapter `signTransaction`
   (handles v0), serialize back. The close/burn batch path can stay legacy.

### Test plan (devnet first)
Create a wallet with a real dust token that has a Jupiter route, turn Sell on,
and confirm: the sell tx builds (no "too complex"), the swap executes, the
owner gets ~70% of proceeds, FEE_WALLET gets 30% of proceeds + 30% of rent,
and the dust account is closed. Decode the tx instruction-by-instruction
before trusting it on mainnet.

### Not blocking
Burn/close works fine, so Sell failing just means dust gets burned instead of
sold. Safe to leave until this is fixed properly with a test loop.
