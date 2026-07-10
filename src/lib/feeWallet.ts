import { PublicKey } from "@solana/web3.js";

/**
 * Receives the 15% Reclaim Rent service fee (see RECLAIM_FEE_RATE in
 * mockTokens.ts). Currently a single keypair's public key — swap for a
 * Squads multisig before mainnet (see docs/backend-architecture.md).
 */
export const FEE_WALLET = new PublicKey("6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1");
