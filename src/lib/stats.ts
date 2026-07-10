/**
 * Real, aggregate platform stats — both are genuinely 0 today because no
 * mainnet transaction has ever run through GetBackSOL yet (devnet preview
 * only). Once Reclaim Rent is live on mainnet, wire these to the fee
 * wallet's on-chain history (or a lightweight indexer) instead of hardcoding
 * them — see docs/backend-architecture.md, section "Leaderboard" for the
 * indexing approach to reuse.
 */
export const PLATFORM_STATS = {
  solReclaimed: 0,
  accountsClosed: 0,
};
