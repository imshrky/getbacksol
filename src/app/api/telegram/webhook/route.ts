import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import { sendTelegramMessage } from "@/lib/telegramClient";
import { RECLAIM_FEE_RATE } from "@/lib/mockTokens";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

const WELCOME_TEXT =
  "Welcome to GetBackSOL.\n\nUse /check <wallet address> to see how much SOL you can reclaim from dormant token accounts — no wallet connection needed, just an address.\n\nWhen you're ready to actually get it back: getbacksol.com";

async function checkWallet(walletParam: string): Promise<string> {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletParam);
  } catch {
    return "That doesn't look like a valid Solana address.";
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  try {
    const { accounts, dustAccounts } = await scanWalletForRentAccounts(connection, wallet);
    if (accounts.length === 0) {
      return dustAccounts.length > 0
        ? `No closable accounts right now, but ${dustAccounts.length} account(s) have leftover dust that needs Safe-Burn first — turn that on at getbacksol.com to unlock them.`
        : "No closable token accounts found for that wallet right now — check back after your next trade.";
    }
    const gross = accounts.reduce((sum, a) => sum + a.reclaimable, 0);
    const net = gross * (1 - RECLAIM_FEE_RATE);
    return `${accounts.length} account${accounts.length === 1 ? "" : "s"} can be closed right now — ~${net.toFixed(6)} SOL reclaimable after the 15% fee.\n\nReclaim it: getbacksol.com`;
  } catch {
    return "Couldn't scan that wallet right now — try again in a moment.";
  }
}

/**
 * Telegram webhook — lets @getbacksolbot respond to commands (currently
 * /check <wallet>) instead of only ever pushing scheduled posts (see
 * /api/cron/telegram-post). Reuses the exact same scan logic as the
 * partner API (/api/v1/scan) — read-only, no wallet connection needed.
 *
 * Protected by Telegram's `secret_token` mechanism: registered once via
 * setWebhook, then sent back on every update as the
 * X-Telegram-Bot-Api-Secret-Token header — without a match, a request here
 * isn't actually from Telegram and is rejected.
 */
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text: string | undefined = message?.text;

  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const [command, ...rest] = text.trim().split(/\s+/);

  try {
    if (command === "/start" || command === "/help") {
      await sendTelegramMessage(chatId, WELCOME_TEXT);
    } else if (command === "/check") {
      const walletParam = rest[0];
      const reply = walletParam ? await checkWallet(walletParam) : "Usage: /check <wallet address>";
      await sendTelegramMessage(chatId, reply);
    } else if (command.startsWith("/")) {
      await sendTelegramMessage(chatId, "Unknown command. Try /check <wallet address>.");
    }
  } catch {
    // Best-effort — never fail the webhook ack over a delivery hiccup,
    // Telegram would just retry the same update.
  }

  return NextResponse.json({ ok: true });
}
