"use client";

import { useEffect, useState } from "react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type PlatformStats = { solReclaimed: number; accountsClosed: number; uniqueWallets: number };

/** Fetches real, all-time platform totals — never a placeholder. */
export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/platform")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStats({
          solReclaimed: Number(data.totalNetLamports ?? 0) / LAMPORTS_PER_SOL,
          accountsClosed: data.totalAccountsClosed ?? 0,
          uniqueWallets: data.uniqueWallets ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
