"use client";

import { useEffect, useState } from "react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type AffiliateStats = { referralCount: number; totalEarnedSol: number };

/** Fetches the connected wallet's own referral-link earnings. */
export function useAffiliateStats(walletAddress: string | null) {
  const [stats, setStats] = useState<AffiliateStats | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;
    fetch(`/api/affiliate/stats?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStats({
          referralCount: data.referralCount ?? 0,
          totalEarnedSol: Number(data.totalEarnedLamports ?? 0) / LAMPORTS_PER_SOL,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return stats;
}
