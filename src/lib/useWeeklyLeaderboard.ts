"use client";

import { useEffect, useState } from "react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type WeeklyRankingEntry = {
  wallet: string;
  xp: number;
  accountsClosed: number;
  solRecoveredSol: number;
  referralCount: number;
};

export type WeeklyLeaderboard = {
  resetAt: string;
  poolSol: number;
  rankings: WeeklyRankingEntry[];
};

/** Fetches the live weekly leaderboard — refreshes periodically so the countdown and ranks stay current. */
export function useWeeklyLeaderboard() {
  const [data, setData] = useState<WeeklyLeaderboard | null>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/leaderboard/weekly")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (cancelled || !json) return;
          setData({
            resetAt: json.resetAt,
            poolSol: Number(json.poolLamports ?? 0) / LAMPORTS_PER_SOL,
            rankings: (json.rankings ?? []).map(
              (r: {
                wallet: string;
                xp: number;
                accountsClosed: number;
                solRecoveredLamports: string;
                referralCount: number;
              }) => ({
                wallet: r.wallet,
                xp: r.xp,
                accountsClosed: r.accountsClosed,
                solRecoveredSol: Number(r.solRecoveredLamports) / LAMPORTS_PER_SOL,
                referralCount: r.referralCount,
              })
            ),
          });
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
