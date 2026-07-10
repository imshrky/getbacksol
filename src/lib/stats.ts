/**
 * Real, aggregate platform stats — both are genuinely 0 today because no
 * real closeAccount transaction has gone through the fee wallet yet. Wire
 * these to the fee wallet's on-chain history (or a lightweight indexer)
 * instead of hardcoding them once there's real activity to show — see
 * docs/backend-architecture.md, section "Leaderboard" for the indexing
 * approach to reuse.
 */
export const PLATFORM_STATS = {
  solReclaimed: 0,
  accountsClosed: 0,
};
