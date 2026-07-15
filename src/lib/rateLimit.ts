import "server-only";
import { getSql } from "./db";

// Partner API keys are self-service and unmoderated (see partners.ts) — a
// key could otherwise hammer /api/v1/scan without limit. 30/minute is
// generous for a partner UI showing scan results to real visitors, but
// bounds the worst case of a misbehaving or malicious key.
const SCAN_REQUESTS_PER_MINUTE = 30;

/**
 * Increments this partner's request count for the current one-minute
 * window and reports whether they're still within the limit. A fixed
 * window counter (not a per-request log) — cheap to check even under real
 * traffic, since it's one upsert per request rather than a growing table
 * scanned every time.
 */
export async function checkScanRateLimit(partnerId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO api_rate_limits (partner_id, window_start, count)
    VALUES (${partnerId}, date_trunc('minute', now()), 1)
    ON CONFLICT (partner_id, window_start) DO UPDATE SET count = api_rate_limits.count + 1
    RETURNING count
  `;
  const count = Number(rows[0]?.count ?? 0);

  // Opportunistic cleanup — no cron job for this table, so ~1% of calls
  // prune windows old enough that nothing will ever check them again.
  if (Math.random() < 0.01) {
    await sql`DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 hour'`;
  }

  return count <= SCAN_REQUESTS_PER_MINUTE;
}
