import "server-only";
import { getSql } from "./db";

// Tunable, not derived from anything — how much weekly XP each activity is
// worth. Kept as constants here rather than config so a rate change is a
// one-line, reviewable diff.
const CLOSING_XP_PER_ACCOUNT = 10;
const REFERRAL_XP_PER_REFERRAL = 1;

// Share of this week's real platform fee revenue that becomes the prize
// pool — a fraction of actual money collected, not an arbitrary number.
export const PRIZE_POOL_SHARE = 0.1;

// How the pool splits across the top 3 — must sum to 1.
export const PAYOUT_SPLIT = [0.5, 0.3, 0.2] as const;

export type WeekWindow = { weekStart: Date; weekEnd: Date };

/** Monday 00:00 UTC of the week containing `d`. */
function getWeekStart(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date;
}

/** The week currently in progress — used for the live public leaderboard. */
export function getCurrentWeekWindow(now = new Date()): WeekWindow {
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { weekStart, weekEnd };
}

/** The most recently completed week — used for the payout admin flow. */
export function getPreviousWeekWindow(now = new Date()): WeekWindow {
  const weekEnd = getWeekStart(now);
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  return { weekStart, weekEnd };
}

export type RankingEntry = {
  wallet: string;
  xp: number;
  accountsClosed: number;
  solRecoveredLamports: string;
  referralCount: number;
};

type ClosingRow = { wallet: string; accounts_closed: number; sol_recovered: string | number };
type ReferralRow = { wallet: string; referral_count: number };

/**
 * Combines closing activity (reclaims) and referral activity (referrals)
 * per wallet into one ranked list. Takes already-fetched rows rather than a
 * time window so the identical merge logic serves both the weekly and the
 * all-time rankings — only the two queries that produce `closingRows` /
 * `referralRows` differ (windowed vs. unwindowed).
 */
function mergeRankings(closingRows: ClosingRow[], referralRows: ReferralRow[], limit: number): RankingEntry[] {
  const byWallet = new Map<string, RankingEntry>();
  for (const row of closingRows) {
    byWallet.set(row.wallet, {
      wallet: row.wallet,
      xp: row.accounts_closed * CLOSING_XP_PER_ACCOUNT,
      accountsClosed: row.accounts_closed,
      solRecoveredLamports: String(row.sol_recovered),
      referralCount: 0,
    });
  }
  for (const row of referralRows) {
    const existing = byWallet.get(row.wallet);
    if (existing) {
      existing.referralCount = row.referral_count;
      existing.xp += row.referral_count * REFERRAL_XP_PER_REFERRAL;
    } else {
      byWallet.set(row.wallet, {
        wallet: row.wallet,
        xp: row.referral_count * REFERRAL_XP_PER_REFERRAL,
        accountsClosed: 0,
        solRecoveredLamports: "0",
        referralCount: row.referral_count,
      });
    }
  }

  return [...byWallet.values()].sort((a, b) => b.xp - a.xp).slice(0, limit);
}

/** This week's rankings — the only ones with a real, payable prize pool. */
export async function getWeeklyRankings(window: WeekWindow, limit = 20): Promise<RankingEntry[]> {
  const sql = getSql();
  const [closingRows, referralRows] = await Promise.all([
    sql`
      SELECT wallet, count(*)::int AS accounts_closed, coalesce(sum(net_lamports), 0) AS sol_recovered
      FROM reclaims
      WHERE created_at >= ${window.weekStart.toISOString()} AND created_at < ${window.weekEnd.toISOString()}
      GROUP BY wallet
    `,
    sql`
      SELECT partner_id AS wallet, count(*)::int AS referral_count
      FROM referrals
      WHERE created_at >= ${window.weekStart.toISOString()} AND created_at < ${window.weekEnd.toISOString()}
      GROUP BY partner_id
    `,
  ]);
  return mergeRankings(closingRows as unknown as ClosingRow[], referralRows as unknown as ReferralRow[], limit);
}

/**
 * All-time rankings across the whole platform — an informational "hall of
 * fame" view, not tied to any prize pool or payout (the weekly leaderboard
 * is the only track with real money attached).
 */
export async function getAllTimeRankings(limit = 20): Promise<RankingEntry[]> {
  const sql = getSql();
  const [closingRows, referralRows] = await Promise.all([
    sql`SELECT wallet, count(*)::int AS accounts_closed, coalesce(sum(net_lamports), 0) AS sol_recovered FROM reclaims GROUP BY wallet`,
    sql`SELECT partner_id AS wallet, count(*)::int AS referral_count FROM referrals GROUP BY partner_id`,
  ]);
  return mergeRankings(closingRows as unknown as ClosingRow[], referralRows as unknown as ReferralRow[], limit);
}

/** This week's prize pool so far — a real share of real fees collected, grows as the week goes on. */
export async function getWeeklyPrizePoolLamports(window: WeekWindow): Promise<bigint> {
  const rows = await getSql()`
    SELECT coalesce(sum(fee_lamports), 0) AS total
    FROM reclaims
    WHERE created_at >= ${window.weekStart.toISOString()} AND created_at < ${window.weekEnd.toISOString()}
  `;
  const totalFeeLamports = BigInt(rows[0]?.total ?? 0);
  return (totalFeeLamports * BigInt(Math.round(PRIZE_POOL_SHARE * 10_000))) / 10_000n;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PendingPayout = {
  weekStart: string;
  poolLamports: string;
  winners: { rank: number; wallet: string; xp: number; amountLamports: string }[];
};

/**
 * The most recently completed week's top 3, if that week had any activity
 * and hasn't already been paid — null otherwise (nothing owed right now).
 */
export async function getPendingPayout(now = new Date()): Promise<PendingPayout | null> {
  const window = getPreviousWeekWindow(now);
  const weekStartKey = toDateKey(window.weekStart);

  const alreadyPaid = await getSql()`
    SELECT 1 FROM weekly_payouts WHERE week_start = ${weekStartKey} LIMIT 1
  `;
  if (alreadyPaid.length > 0) return null;

  const [rankings, poolLamports] = await Promise.all([
    getWeeklyRankings(window, 3),
    getWeeklyPrizePoolLamports(window),
  ]);
  if (rankings.length === 0 || poolLamports <= 0n) return null;

  const winners = rankings.map((entry, i) => ({
    rank: i + 1,
    wallet: entry.wallet,
    xp: entry.xp,
    amountLamports: String((poolLamports * BigInt(Math.round(PAYOUT_SPLIT[i] * 10_000))) / 10_000n),
  }));

  return { weekStart: weekStartKey, poolLamports: String(poolLamports), winners };
}

/** Records a real, already-confirmed weekly prize payment — see /api/leaderboard/payout. */
export async function recordWeeklyPayout(
  weekStart: string,
  rank: number,
  wallet: string,
  xp: number,
  amountLamports: bigint,
  txSignature: string
): Promise<void> {
  await getSql()`
    INSERT INTO weekly_payouts (week_start, rank, wallet, xp, amount_lamports, tx_signature)
    VALUES (${weekStart}, ${rank}, ${wallet}, ${xp}, ${amountLamports.toString()}, ${txSignature})
    ON CONFLICT (week_start, rank) DO NOTHING
  `;
}
