import "server-only";
import { getSql } from "./db";

export type ReclaimHistoryEntry = {
  wallet: string;
  txSignature: string;
  accountsClosed: number;
  netLamports: string;
  createdAt: string;
};

/**
 * Records one confirmed reclaim transaction — every one, referred or not,
 * unlike the `referrals` ledger which only tracks partner-attributed
 * fees. Purely a public activity feed (see getReclaimHistory); best-effort
 * only, called after the real transaction has already confirmed, so a
 * failure here must never surface as an error to the user. `feeLamports`
 * is the platform fee already validated in /api/relay-close (never
 * recomputed here) — it feeds the weekly leaderboard prize pool (see
 * src/lib/leaderboard.ts), not just this activity feed.
 */
export async function recordReclaim(
  wallet: string,
  txSignature: string,
  accountsClosed: number,
  netLamports: bigint,
  feeLamports: bigint
): Promise<void> {
  try {
    await getSql()`
      INSERT INTO reclaims (wallet, tx_signature, accounts_closed, net_lamports, fee_lamports)
      VALUES (${wallet}, ${txSignature}, ${accountsClosed}, ${netLamports.toString()}, ${feeLamports.toString()})
    `;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") return; // already recorded for this signature
    throw e;
  }
}

/** Public read of the most recent reclaims across the whole platform. */
export async function getReclaimHistory(limit = 20): Promise<ReclaimHistoryEntry[]> {
  const rows = await getSql()`
    SELECT wallet, tx_signature, accounts_closed, net_lamports, created_at
    FROM reclaims
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    wallet: row.wallet,
    txSignature: row.tx_signature,
    accountsClosed: row.accounts_closed,
    netLamports: String(row.net_lamports),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export type PlatformStats = {
  totalNetLamports: string;
  totalAccountsClosed: number;
  uniqueWallets: number;
};

/**
 * All-time real totals across every reclaim ever recorded — powers the
 * homepage's ImpactStats and the Telegram milestone post (see
 * telegramPosts.ts). Never a placeholder: genuinely 0 until the first real
 * reclaim lands, exactly like the number it replaced.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const rows = await getSql()`
    SELECT
      coalesce(sum(net_lamports), 0) AS total_net,
      coalesce(sum(accounts_closed), 0)::int AS total_accounts,
      count(distinct wallet)::int AS unique_wallets
    FROM reclaims
  `;
  return {
    totalNetLamports: String(rows[0]?.total_net ?? 0),
    totalAccountsClosed: rows[0]?.total_accounts ?? 0,
    uniqueWallets: rows[0]?.unique_wallets ?? 0,
  };
}
