import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import { sendTelegramMessage, answerCallbackQuery, type InlineKeyboard } from "@/lib/telegramClient";
import { RECLAIM_FEE_RATE } from "@/lib/mockTokens";
import { FAQ_ITEMS } from "@/lib/faqContent";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const SITE_URL = "https://getbacksol.com";

const MAIN_KEYBOARD: InlineKeyboard = [
  [{ text: "🔍 Scan my wallet", url: SITE_URL }],
  [
    { text: "💰 Check a wallet", callback_data: "prompt_check" },
    { text: "📖 FAQ", callback_data: "show_faq" },
  ],
  [{ text: "🆘 Help", callback_data: "show_help" }],
];

const BACK_KEYBOARD: InlineKeyboard = [[{ text: "⬅️ Back", callback_data: "back_to_menu" }]];

const WELCOME_TEXT =
  "Welcome to GetBackSOL 👋\n\nEvery empty token account in your Solana wallet is still holding a small SOL deposit — we help you get it back.\n\nPick an option below, or just send /check <wallet address> any time.";

const HELP_TEXT =
  "Here's what I can do:\n\n/check <wallet address> — see how much SOL a wallet can reclaim, no wallet connection needed\n/scan — link to the full app to actually connect a wallet and reclaim\n/faq — frequently asked questions\n\nEverything here is read-only and non-custodial — I never ask for a private key or seed phrase, and neither does the website.";

const CHECK_PROMPT_TEXT = "Send /check <wallet address> — for example:\n/check 6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1";

function faqText(): string {
  const body = FAQ_ITEMS.map((item) => `❓ ${item.q}\n${item.a}`).join("\n\n");
  return `${body}\n\nMore questions? Ask on Telegram: https://telegram.me/GetBackSOL`;
}

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
        ? `No closable accounts right now, but ${dustAccounts.length} account(s) have leftover dust that needs Safe-Burn first — turn that on at ${SITE_URL} to unlock them.`
        : "No closable token accounts found for that wallet right now — check back after your next trade.";
    }
    const gross = accounts.reduce((sum, a) => sum + a.reclaimable, 0);
    const net = gross * (1 - RECLAIM_FEE_RATE);
    return `${accounts.length} account${accounts.length === 1 ? "" : "s"} can be closed right now — ~${net.toFixed(6)} SOL reclaimable after the 15% fee.\n\nReclaim it: ${SITE_URL}`;
  } catch {
    return "Couldn't scan that wallet right now — try again in a moment.";
  }
}

/**
 * Telegram webhook — lets @getbacksolbot respond to commands and inline
 * keyboard taps (see MAIN_KEYBOARD), not just push scheduled posts (see
 * /api/cron/telegram-post). /check reuses the exact same scan logic as the
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

  // Inline keyboard button tap — must always be acknowledged (even for
  // unrecognized data) so the tapped button stops showing a spinner.
  const callback = update?.callback_query;
  if (callback) {
    const chatId = callback.message?.chat?.id;
    try {
      await answerCallbackQuery(callback.id);
      if (chatId) {
        if (callback.data === "show_faq") await sendTelegramMessage(chatId, faqText(), BACK_KEYBOARD);
        else if (callback.data === "show_help") await sendTelegramMessage(chatId, HELP_TEXT, BACK_KEYBOARD);
        else if (callback.data === "prompt_check")
          await sendTelegramMessage(chatId, CHECK_PROMPT_TEXT, BACK_KEYBOARD);
        else if (callback.data === "back_to_menu")
          await sendTelegramMessage(chatId, WELCOME_TEXT, MAIN_KEYBOARD);
      }
    } catch {
      // best-effort
    }
    return NextResponse.json({ ok: true });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text: string | undefined = message?.text;

  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const [command, ...rest] = text.trim().split(/\s+/);

  try {
    if (command === "/start") {
      await sendTelegramMessage(chatId, WELCOME_TEXT, MAIN_KEYBOARD);
    } else if (command === "/help") {
      await sendTelegramMessage(chatId, HELP_TEXT);
    } else if (command === "/faq") {
      await sendTelegramMessage(chatId, faqText());
    } else if (command === "/scan") {
      await sendTelegramMessage(chatId, "Connect your wallet and scan for reclaimable SOL here:", [
        [{ text: "🔍 Open GetBackSOL", url: SITE_URL }],
      ]);
    } else if (command === "/check") {
      const walletParam = rest[0];
      const reply = walletParam ? await checkWallet(walletParam) : "Usage: /check <wallet address>";
      await sendTelegramMessage(chatId, reply);
    } else if (command.startsWith("/")) {
      await sendTelegramMessage(chatId, "Unknown command. Try /help to see what I can do.");
    }
  } catch {
    // Best-effort — never fail the webhook ack over a delivery hiccup,
    // Telegram would just retry the same update.
  }

  return NextResponse.json({ ok: true });
}
