# TODO — Native Raydium liquidity pool creation (ON HOLD)

Status: **on hold**, to be done with the tower PC (local dev) — the Token
Creator currently links out to Raydium instead (see the "make it tradeable"
card in `src/app/token-creator/page.tsx`). This is the plan for the native
in-app version.

## Why it's on hold

The Raydium SDK can't be installed or run in the assistant's environment, so
the pool-creation code can't be verified there. It handles real user capital
(their liquidity), so a bug loses money. It needs a **fast local test loop**:
run the repo on the tower (`npm install && npm run dev`) so iterations take
seconds, not a 2-min Vercel deploy + real SOL per test. Debug on **devnet**
first (free SOL), then flip to mainnet once it works.

## What's confirmed

- **Feasible & free**: Raydium SDK v2 creates **CPMM** pools permissionlessly,
  supports Token-2022, cheaper than AMM v4, recommended for permissionless
  listings. Not a REST API — the SDK builds an on-chain tx the **user signs**.
- **Jupiter listing is automatic**: any token with a valid pool on a
  Jupiter-integrated DEX (Raydium) is auto-detected within minutes and routed.
  Nothing to build/apply for. Liquidity is re-checked ~every 30 min; below a
  minimum the market is dropped.
- **Money model** (same as the rest of the app — no custody, no fronting): the
  user's own wallet signs one tx that pays Raydium's fees (~0.3 SOL: creation
  fee + rent) + provides the liquidity (their tokens + SOL) + a transfer of our
  commission (e.g. 0.1 SOL) to `FEE_WALLET`. We only build the tx; the user
  pays everything. We never touch their capital.

## Plan when picking it up

1. `npm i @raydium-io/raydium-sdk-v2` (+ `bn.js` if needed).
2. `src/lib/useCreatePool.ts` — client hook: `Raydium.load({ connection, owner, signAllTransactions })`, fetch CPMM configs, `raydium.cpmm.createPool({ mintA, mintB=WSOL, amounts, feeConfig, ... })`, add our fee transfer instruction, user signs, send.
3. UI: a pool step after token creation (token amount + SOL amount), or wire the existing `create-liquidity` mockup page.
4. Gate it OFF by default (kill-switch like `NEXT_PUBLIC_TOKEN_CREATOR_LIVE`) — it moves real liquidity, so test with tiny amounts before enabling.
5. Reference: official demo repo https://github.com/raydium-io/raydium-sdk-V2-demo (CPMM examples), docs https://docs.raydium.io/user-flows/create-cpmm-pool.

## Verifying Jupiter after a real pool exists

Create a token + pool, then search the mint on jup.ag — it should appear
(with logo, from the Metaplex/IPFS metadata we already attach) within minutes.
