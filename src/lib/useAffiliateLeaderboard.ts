"use client";

import { useEffect, useState } from "react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type LeaderboardEntry = { walletAddress: string; referralCount: number; totalEarnedSol: number };

/** Fetches the public top-5 wallet affiliates by total earned. */
export function useAffiliateLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/affiliate/leaderboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.leaderboard) return;
        setEntries(
          data.leaderboard.map((e: { walletAddress: string; referralCount: number; totalEarnedLamports: string }) => ({
            walletAddress: e.walletAddress,
            referralCount: e.referralCount,
            totalEarnedSol: Number(e.totalEarnedLamports) / LAMPORTS_PER_SOL,
          }))
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return entries;
}
