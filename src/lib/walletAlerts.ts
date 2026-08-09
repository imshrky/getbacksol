import "server-only";
import { getSql } from "./db";

// Opt-in Telegram alerts: a Telegram chat subscribes to a wallet (via the
// bot's start=wallet_<address> deep link), and a cron re-scans it and pings
// the chat when new reclaimable SOL shows up. `last_seen_lamports` is the
// reclaimable amount we last observed, so we only alert on genuine increases
// and never re-spam the same balance.
export type WalletAlertRow = {
  chatId: number;
  wallet: string;
  lastSeenLamports: string;
};

/**
 * Links a Telegram chat to a wallet for alerts (idempotent). `initialLamports`
 * seeds last_seen_lamports so the first cron run doesn't re-announce SOL the
 * user already has when they subscribe. A repeat subscribe is a no-op (the
 * existing baseline is kept, never reset).
 */
export async function subscribeWalletAlert(
  chatId: number,
  wallet: string,
  initialLamports: bigint = 0n
): Promise<void> {
  await getSql()`
    INSERT INTO wallet_alerts (chat_id, wallet, last_seen_lamports)
    VALUES (${chatId}, ${wallet}, ${initialLamports.toString()})
    ON CONFLICT (chat_id, wallet) DO NOTHING
  `;
}

/**
 * A batch of subscriptions to check this run, least-recently-alerted first so
 * load spreads across cron runs instead of scanning everyone every time.
 */
export async function getWalletAlertSubscriptions(limit = 50): Promise<WalletAlertRow[]> {
  const rows = await getSql()`
    SELECT chat_id, wallet, last_seen_lamports
    FROM wallet_alerts
    ORDER BY last_alerted_at ASC NULLS FIRST
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    chatId: Number(r.chat_id),
    wallet: r.wallet as string,
    lastSeenLamports: String(r.last_seen_lamports),
  }));
}

/** Wallets a given chat is currently subscribed to, oldest first. */
export async function getChatSubscriptions(chatId: number): Promise<string[]> {
  const rows = await getSql()`
    SELECT wallet FROM wallet_alerts
    WHERE chat_id = ${chatId}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => r.wallet as string);
}

/** Turns alerts off for one (chat, wallet) pair. No-op if not subscribed. */
export async function unsubscribeWalletAlert(chatId: number, wallet: string): Promise<void> {
  await getSql()`
    DELETE FROM wallet_alerts WHERE chat_id = ${chatId} AND wallet = ${wallet}
  `;
}

/**
 * Records the latest observed reclaimable amount. Pass `alerted` when we just
 * messaged the chat, which also bumps last_alerted_at so this subscription
 * moves to the back of the queue.
 */
export async function updateWalletAlertSeen(
  chatId: number,
  wallet: string,
  lamports: bigint,
  alerted: boolean
): Promise<void> {
  if (alerted) {
    await getSql()`
      UPDATE wallet_alerts
      SET last_seen_lamports = ${lamports.toString()}, last_alerted_at = now()
      WHERE chat_id = ${chatId} AND wallet = ${wallet}
    `;
  } else {
    await getSql()`
      UPDATE wallet_alerts
      SET last_seen_lamports = ${lamports.toString()}
      WHERE chat_id = ${chatId} AND wallet = ${wallet}
    `;
  }
}
