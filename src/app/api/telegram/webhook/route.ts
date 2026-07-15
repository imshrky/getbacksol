import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  type InlineKeyboard,
} from "@/lib/telegramClient";
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
  "Welcome to GetBackSOL 👋\n\nEvery empty token account in your Solana wallet is still holding a small SOL deposit. We help you get it back.\n\nPick an option below, or just send a wallet address any time.";

const HELP_TEXT =
  "Here's what I can do:\n\nJust send me a wallet address, no command needed, and I'll tell you how much SOL it can reclaim. No wallet connection required.\n\n/scan: link to the full app to actually connect a wallet and reclaim\n/faq: frequently asked questions\n\nEverything here is read-only and non-custodial. I never ask for a private key or seed phrase, and neither does the website.";

const CHECK_PROMPT_TEXT =
  "Send a wallet address, just paste it, no command needed, and I'll tell you how much SOL it can reclaim.";

function isSolanaAddress(text: string): boolean {
  try {
    new PublicKey(text);
    return true;
  } catch {
    return false;
  }
}

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

    if (accounts.length === 0 && dustAccounts.length === 0) {
      return "No token accounts found for that wallet right now. Check back after your next trade.";
    }

    // "Potential" always means the full picture: what's closable right now,
    // plus what dust accounts would add if burned first (Safe-Burn does
    // this automatically on the site), not just the immediately-closable
    // subset, which understates how much is actually recoverable.
    const closableGross = accounts.reduce((sum, a) => sum + a.reclaimable, 0);
    const closableNet = closableGross * (1 - RECLAIM_FEE_RATE);
    const dustGross = dustAccounts.reduce((sum, a) => sum + a.reclaimable, 0);
    const totalNet = (closableGross + dustGross) * (1 - RECLAIM_FEE_RATE);

    if (accounts.length === 0) {
      return `No accounts are closable right now, but ${dustAccounts.length} account${dustAccounts.length === 1 ? "" : "s"} hold leftover dust: ~${totalNet.toFixed(6)} SOL potentially reclaimable if you burn them first (Safe-Burn does this automatically).\n\nClaim now 👉 ${SITE_URL}`;
    }

    let reply = `${accounts.length} account${accounts.length === 1 ? "" : "s"} can be closed right now: ~${closableNet.toFixed(6)} SOL reclaimable after the 15% fee.`;
    if (dustAccounts.length > 0) {
      reply += ` With Safe-Burn on for the ${dustAccounts.length} dust account${dustAccounts.length === 1 ? "" : "s"} too, the total potential is ~${totalNet.toFixed(6)} SOL.`;
    }
    reply += `\n\nClaim now 👉 ${SITE_URL}`;
    return reply;
  } catch {
    return "Couldn't scan that wallet right now. Try again in a moment.";
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
    const messageId = callback.message?.message_id;
    try {
      await answerCallbackQuery(callback.id);
      if (chatId && messageId) {
        if (callback.data === "show_faq") await editTelegramMessage(chatId, messageId, faqText(), BACK_KEYBOARD);
        else if (callback.data === "show_help")
          await editTelegramMessage(chatId, messageId, HELP_TEXT, BACK_KEYBOARD);
        else if (callback.data === "prompt_check")
          await editTelegramMessage(chatId, messageId, CHECK_PROMPT_TEXT, BACK_KEYBOARD);
        else if (callback.data === "back_to_menu")
          await editTelegramMessage(chatId, messageId, WELCOME_TEXT, MAIN_KEYBOARD);
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
    } else if (rest.length === 0 && isSolanaAddress(command)) {
      // No command prefix needed — a bare wallet address is enough.
      await sendTelegramMessage(chatId, await checkWallet(command));
    } else {
      await sendTelegramMessage(chatId, "Send a wallet address, or try /help to see what I can do.");
    }
  } catch {
    // Best-effort — never fail the webhook ack over a delivery hiccup,
    // Telegram would just retry the same update.
  }

  return NextResponse.json({ ok: true });
}
