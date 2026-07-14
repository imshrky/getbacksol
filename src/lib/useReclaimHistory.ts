"use client";

import { useEffect, useState } from "react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type ReclaimHistoryRow = {
  wallet: string;
  txSignature: string;
  accountsClosed: number;
  netSol: number;
  createdAt: string;
};

/** Fetches the public feed of recent reclaim transactions platform-wide. */
export function useReclaimHistory() {
  const [rows, setRows] = useState<ReclaimHistoryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reclaims/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.history) return;
        setRows(
          data.history.map(
            (r: { wallet: string; txSignature: string; accountsClosed: number; netLamports: string; createdAt: string }) => ({
              wallet: r.wallet,
              txSignature: r.txSignature,
              accountsClosed: r.accountsClosed,
              netSol: Number(r.netLamports) / LAMPORTS_PER_SOL,
              createdAt: r.createdAt,
            })
          )
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return rows;
}
