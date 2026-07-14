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
 * failure here must never surface as an error to the user.
 */
export async function recordReclaim(
  wallet: string,
  txSignature: string,
  accountsClosed: number,
  netLamports: bigint
): Promise<void> {
  try {
    await getSql()`
      INSERT INTO reclaims (wallet, tx_signature, accounts_closed, net_lamports)
      VALUES (${wallet}, ${txSignature}, ${accountsClosed}, ${netLamports.toString()})
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
