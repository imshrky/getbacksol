import { PLATFORM_STATS } from "@/lib/stats";

/**
 * Renders nothing until there's real activity to show — we never display a
 * fabricated "X SOL reclaimed" number. Once PLATFORM_STATS is wired to real
 * on-chain data post-mainnet-launch, this activates automatically.
 */
export function ImpactStats() {
  const { solReclaimed, accountsClosed } = PLATFORM_STATS;
  if (solReclaimed <= 0 && accountsClosed <= 0) return null;

  return (
    <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <div className="text-center">
        <div className="text-xl font-semibold tabular-nums">{solReclaimed.toFixed(2)} SOL</div>
        <div className="text-xs text-[var(--muted)]">reclaimed so far</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-semibold tabular-nums">{accountsClosed.toLocaleString()}</div>
        <div className="text-xs text-[var(--muted)]">accounts closed</div>
      </div>
    </div>
  );
}
