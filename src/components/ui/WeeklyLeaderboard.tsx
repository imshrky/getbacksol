"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { useWeeklyLeaderboard } from "@/lib/useWeeklyLeaderboard";

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];
const SPLIT_LABELS = ["1st: 50%", "2nd: 30%", "3rd: 20%"];

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function useCountdown(resetAt: string | null) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!resetAt) return;
    const target = new Date(resetAt).getTime();

    function tick() {
      const ms = Math.max(0, target - Date.now());
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setLabel(`${d}d ${h}h ${m}m ${s}s`);
    }

    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [resetAt]);

  return label;
}

/**
 * Public weekly ranking — combines closing activity (reclaims) and referral
 * activity into one XP score per wallet (see src/lib/leaderboard.ts). The
 * prize pool shown is a real share of this week's platform fee revenue,
 * paid out to the top 3 after the week ends (manually, by whoever holds the
 * FEE_WALLET key — see /admin/leaderboard).
 */
export function WeeklyLeaderboard({ currentWallet }: { currentWallet?: string }) {
  const data = useWeeklyLeaderboard();
  const countdown = useCountdown(data?.resetAt ?? null);

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-sm font-medium">Weekly XP Leaderboard</p>
        </div>
        <span className="text-xs text-[var(--muted)]">Resets in {countdown}</span>
      </div>

      <div className="mb-4 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-emerald-400">This week&apos;s prize pool</span>
          <span className="font-mono text-sm font-semibold text-emerald-400">
            {(data?.poolSol ?? 0).toFixed(4)} SOL
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Grows with platform activity, paid to the top 3 every week.
        </p>
        <div className="mt-2 flex gap-3 text-[11px] text-[var(--muted)]">
          {SPLIT_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : data.rankings.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No activity yet this week — close accounts or refer a friend to take the first spot.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.rankings.map((entry, i) => {
            const isYou = currentWallet && entry.wallet === currentWallet;
            return (
              <li
                key={entry.wallet}
                className={`flex items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 ${
                  isYou ? "bg-[var(--accent)]/10" : "surface-hover"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {i < 3 ? (
                    <Medal className={`h-4 w-4 shrink-0 ${MEDAL_COLORS[i]}`} />
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs font-semibold text-[var(--muted)]">
                      {i + 1}
                    </span>
                  )}
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      {shortenAddress(entry.wallet)}
                      {isYou && <span className="pill">You</span>}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {entry.solRecoveredSol.toFixed(4)} SOL recovered
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold text-[var(--accent)]">{entry.xp} XP</span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {entry.accountsClosed} closing · {entry.referralCount} referral
                    {entry.referralCount === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
