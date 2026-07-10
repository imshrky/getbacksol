import { PublicKey } from "@solana/web3.js";

/**
 * Receives the 15% Reclaim Rent service fee (see RECLAIM_FEE_RATE in
 * mockTokens.ts). Reads NEXT_PUBLIC_FEE_WALLET_ADDRESS so the address can be
 * swapped (e.g. for a Squads multisig before mainnet, see
 * docs/backend-architecture.md) via a Vercel env var instead of a code change.
 */
export const FEE_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_FEE_WALLET_ADDRESS || "6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1"
);
