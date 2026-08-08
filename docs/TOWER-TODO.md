# Chantiers à faire sur la tour PC (boucle de test locale)

These two features can't be built/verified in the assistant's Mac environment
(no Node to install the SDKs, no way to sign mainnet transactions, can't run
the code). They handle real funds and are complex, so they need a **fast local
dev loop**: run the repo on the tower (`npm install && npm run dev`), debug on
**devnet** first (free SOL), then flip to mainnet once verified.

When resuming with Claude on the tower, start by reading this file.

---

## 1. Native Raydium liquidity pool creation

Status: on hold. Full plan, cost model and steps in **`docs/RAYDIUM-POOL-TODO.md`**.
Summary: use `@raydium-io/raydium-sdk-v2` (CPMM, permissionless, free SDK) to
build a pool-creation tx the user signs; add our fee instruction; gate it OFF
by default; test with tiny amounts. Jupiter then lists the token automatically.
The Token Creator currently links out to Raydium instead (safe interim).

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
