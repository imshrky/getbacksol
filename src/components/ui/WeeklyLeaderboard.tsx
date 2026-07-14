"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Zap, DoorClosed, Users } from "lucide-react";
import { useWeeklyLeaderboard, type LeaderboardPeriod, type WeeklyRankingEntry } from "@/lib/useWeeklyLeaderboard";

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];
// Matches PAYOUT_SPLIT in src/lib/leaderboard.ts — display only, the real
// split is computed and enforced server-side.
const PAYOUT_SPLIT_LABELS = ["50%", "30%", "20%"];

type Metric = "xp" | "closing" | "referrals";

const METRIC_TABS: { id: Metric; label: string; icon: typeof Zap }[] = [
  { id: "xp", label: "XP Leaderboard", icon: Zap },
  { id: "closing", label: "Top Closers", icon: DoorClosed },
  { id: "referrals", label: "Top Referrers", icon: Users },
];

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function sortByMetric(rankings: WeeklyRankingEntry[], metric: Metric): WeeklyRankingEntry[] {
  if (metric === "closing") return [...rankings].sort((a, b) => b.accountsClosed - a.accountsClosed);
  if (metric === "referrals") return [...rankings].sort((a, b) => b.referralCount - a.referralCount);
  return rankings; // already sorted by xp from the API
}

function primaryStat(entry: WeeklyRankingEntry, metric: Metric): string {
  if (metric === "closing") return `${entry.accountsClosed} accounts closed`;
  if (metric === "referrals") return `${entry.referralCount} referral${entry.referralCount === 1 ? "" : "s"}`;
  return `${entry.xp} XP`;
}

function secondaryStat(entry: WeeklyRankingEntry, metric: Metric): string {
  if (metric === "closing") return `${entry.solRecoveredSol.toFixed(4)} SOL recovered`;
  if (metric === "referrals") return `${entry.accountsClosed} accounts closed`;
  return `${entry.accountsClosed} closing · ${entry.referralCount} referral${entry.referralCount === 1 ? "" : "s"}`;
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
 * Public leaderboard — one real prize pool (weekly XP, combining closing
 * and referral activity, see src/lib/leaderboard.ts), plus "Top Closers" /
 * "Top Referrers" as alternate sort views of the exact same data, and an
 * "All-time" period as an informational hall-of-fame with no pool attached.
 * Only the XP tab in the "This week" period ever shows a payable amount.
 */
export function WeeklyLeaderboard({ currentWallet }: { currentWallet?: string }) {
  const [metric, setMetric] = useState<Metric>("xp");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const data = useWeeklyLeaderboard(period);
  const countdown = useCountdown(data?.resetAt ?? null);

  const rankings = useMemo(() => sortByMetric(data?.rankings ?? [], metric), [data, metric]);
  const showPool = metric === "xp" && period === "week";
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-sm font-medium">Weekly XP Leaderboard</p>
        </div>
        {period === "week" && <span className="text-xs text-[var(--muted)]">Resets in {countdown}</span>}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRIC_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMetric(tab.id)}
            className={`flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
              metric === tab.id
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          {(["week", "all-time"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {p === "week" ? "This week" : "All-time"}
            </button>
          ))}
        </div>
      </div>

      {showPool && (
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
            {PAYOUT_SPLIT_LABELS.map((label, i) => (
              <span key={label}>
                {i + 1}
                {i === 0 ? "st" : i === 1 ? "nd" : "rd"}: {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {!data ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : rankings.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No activity yet — close accounts or refer a friend to take the first spot.
        </p>
      ) : (
        <>
          {top3.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {top3.map((entry, i) => {
                const isYou = currentWallet && entry.wallet === currentWallet;
                return (
                  <div
                    key={entry.wallet}
                    className={`rounded-[8px] border p-3 ${
                      isYou ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Medal className={`h-4 w-4 ${MEDAL_COLORS[i]}`} />
                      {showPool && (
                        <span className="pill !border-none !p-0 text-[var(--muted)]">
                          {PAYOUT_SPLIT_LABELS[i]}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 font-mono text-xs">
                      {shortenAddress(entry.wallet)}
                      {isYou && <span className="pill">You</span>}
                    </p>
                    <p className="mt-2 text-sm font-semibold">{primaryStat(entry, metric)}</p>
                    <p className="text-[11px] text-[var(--muted)]">{secondaryStat(entry, metric)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <ol className="flex flex-col gap-2">
              {rest.map((entry, i) => {
                const isYou = currentWallet && entry.wallet === currentWallet;
                return (
                  <li
                    key={entry.wallet}
                    className={`flex items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 ${
                      isYou ? "bg-[var(--accent)]/10" : "surface-hover"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs font-semibold text-[var(--muted)]">
                        {i + 4}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-xs">
                        {shortenAddress(entry.wallet)}
                        {isYou && <span className="pill">You</span>}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-semibold text-[var(--accent)]">
                        {primaryStat(entry, metric)}
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">{secondaryStat(entry, metric)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
