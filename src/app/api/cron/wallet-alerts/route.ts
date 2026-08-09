import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import { calculateReclaimSummary } from "@/lib/reclaimRent";
import { sendTelegramMessage } from "@/lib/telegramClient";
import {
  getWalletAlertSubscriptions,
  updateWalletAlertSeen,
} from "@/lib/walletAlerts";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const SITE_URL = "https://getbacksol.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

// Only alert once the reclaimable amount crosses something worth a trip back to
// the site — roughly a couple of accounts' worth of rent — so a single fresh
// dust account doesn't spam everyone. Tunable.
const MIN_ALERT_LAMPORTS = 5_000_000n; // 0.005 SOL gross

// Cap per run so a growing subscriber list can't blow the function timeout;
// getWalletAlertSubscriptions returns least-recently-alerted first, so this
// naturally rotates through everyone across successive runs.
const MAX_PER_RUN = 50;

/**
 * Vercel Cron target (see vercel.json) — the automatic side of opt-in wallet
 * alerts. Re-scans each subscribed wallet and DMs the linked Telegram chat when
 * new reclaimable SOL has appeared since we last looked. Fully automatic: the
 * user's only action was the one-time opt-in tap on the site (Telegram forbids
 * messaging a chat that never started the bot), everything here runs on its own.
 *
 * State lives in wallet_alerts.last_seen_lamports (gross reclaimable lamports),
 * so we alert only on genuine increases and never re-announce the same balance.
 * Protected by CRON_SECRET — same shared secret as the other cron routes, sent
 * automatically as a Bearer token by Vercel on scheduled invocations.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subs;
  try {
    subs = await getWalletAlertSubscriptions(MAX_PER_RUN);
  } catch (e) {
    // Database not configured / unreachable — 503 rather than a generic 500.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Alerts store unavailable." },
      { status: 503 }
    );
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  let scanned = 0;
  let alerted = 0;

  for (const sub of subs) {
    scanned++;
    try {
      const wallet = new PublicKey(sub.wallet);
      const { accounts, dustAccounts } = await scanWalletForRentAccounts(connection, wallet);

      const all = [...accounts, ...dustAccounts];
      const grossSol = all.reduce((s, a) => s + a.reclaimable, 0);
      const grossLamports = BigInt(Math.round(grossSol * LAMPORTS_PER_SOL));
      const lastSeen = BigInt(sub.lastSeenLamports);

      if (grossLamports > lastSeen && grossLamports >= MIN_ALERT_LAMPORTS) {
        // New reclaimable SOL crossed the threshold → nudge them back.
        const netSol = calculateReclaimSummary(all).net;
        const short = `${sub.wallet.slice(0, 4)}…${sub.wallet.slice(-4)}`;
        await sendTelegramMessage(
          sub.chatId,
          `🔓 New SOL to reclaim!\n\n${short} now has ~${netSol.toFixed(6)} SOL waiting for you (after the 30% fee). Get it back in a couple of taps 👇`,
          [[{ text: "💰 Reclaim now", url: SITE_URL }]]
        );
        await updateWalletAlertSeen(sub.chatId, sub.wallet, grossLamports, true);
        alerted++;
      } else if (grossLamports !== lastSeen) {
        // Amount changed but no alert (they reclaimed, or it's still below the
        // threshold) — silently move the baseline so a future rise re-triggers.
        await updateWalletAlertSeen(sub.chatId, sub.wallet, grossLamports, false);
      }
    } catch {
      // Skip this wallet this run — a bad RPC read or a blocked DM shouldn't
      // stop the rest of the batch.
    }
  }

  return NextResponse.json({ scanned, alerted });
}
