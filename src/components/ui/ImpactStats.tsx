"use client";

import { usePlatformStats } from "@/lib/usePlatformStats";

/**
 * Renders nothing until there's real activity to show — we never display a
 * fabricated "X SOL reclaimed" number. Fetches real, all-time totals from
 * /api/stats/platform (see reclaims.ts's getPlatformStats).
 */
export function ImpactStats() {
  const stats = usePlatformStats();
  if (!stats || (stats.solReclaimed <= 0 && stats.accountsClosed <= 0)) return null;

  return (
    <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <div className="text-center">
        <div className="text-xl font-semibold tabular-nums">{stats.solReclaimed.toFixed(2)} SOL</div>
        <div className="text-xs text-[var(--muted)]">reclaimed so far</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-semibold tabular-nums">{stats.accountsClosed.toLocaleString()}</div>
        <div className="text-xs text-[var(--muted)]">accounts closed</div>
      </div>
    </div>
  );
}
