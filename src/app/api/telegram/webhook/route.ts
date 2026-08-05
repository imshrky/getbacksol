import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  restrictChatMember,
  deleteTelegramMessage,
  type InlineKeyboard,
  type ChatPermissions,
} from "@/lib/telegramClient";
import { FAQ_ITEMS } from "@/lib/faqContent";
import { calculateReclaimSummary } from "@/lib/reclaimRent";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const SITE_URL = "https://getbacksol.com";

// New members are muted on join until they tap the captcha button, then
// restored. A scammer who never taps simply can't post — no auto-kick needed,
// since a stateless webhook has nowhere to schedule one from.
const MUTED_PERMISSIONS: ChatPermissions = {
  can_send_messages: false,
  can_send_media_messages: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
};
const UNMUTED_PERMISSIONS: ChatPermissions = {
  can_send_messages: true,
  can_send_media_messages: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
};

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

type CheckResult = { text: string; keyboard?: InlineKeyboard };

// The button always deep-links to the site rather than acting here: burning
// and closing are on-chain transactions the owner has to sign with their own
// wallet, which can't be connected from inside Telegram. The button's job is
// to get them to the one place that can, in one tap.
const RECLAIM_BUTTON: InlineKeyboard = [[{ text: "💰 Reclaim now", url: SITE_URL }]];
const BURN_BUTTON: InlineKeyboard = [[{ text: "🔥 Burn & reclaim now", url: SITE_URL }]];

async function checkWallet(walletParam: string): Promise<CheckResult> {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletParam);
  } catch {
    return { text: "That doesn't look like a valid Solana address." };
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  try {
    const { accounts, dustAccounts } = await scanWalletForRentAccounts(connection, wallet);

    if (accounts.length === 0 && dustAccounts.length === 0) {
      return { text: "No token accounts found for that wallet right now. Check back after your next trade." };
    }

    // "Potential" always means the full picture: what's closable right now,
    // plus what dust accounts would add if burned first (Safe-Burn does
    // this automatically on the site), not just the immediately-closable
    // subset, which understates how much is actually recoverable.
    const closableNet = calculateReclaimSummary(accounts).net;
    const totalNet = calculateReclaimSummary([...accounts, ...dustAccounts]).net;

    if (accounts.length === 0) {
      // Dust only — nothing closes without burning first, so the CTA is Burn.
      return {
        text: `No accounts are closable right now, but ${dustAccounts.length} account${dustAccounts.length === 1 ? "" : "s"} hold leftover dust: ~${totalNet.toFixed(6)} SOL potentially reclaimable if you burn them first (Safe-Burn does this automatically).\n\nClaim now 👉 ${SITE_URL}`,
        keyboard: BURN_BUTTON,
      };
    }

    let reply = `${accounts.length} account${accounts.length === 1 ? "" : "s"} can be closed right now: ~${closableNet.toFixed(6)} SOL reclaimable after the 30% fee.`;
    if (dustAccounts.length > 0) {
      reply += ` With Safe-Burn on for the ${dustAccounts.length} dust account${dustAccounts.length === 1 ? "" : "s"} too, the total potential is ~${totalNet.toFixed(6)} SOL.`;
    }
    reply += `\n\nClaim now 👉 ${SITE_URL}`;
    // Closable accounts (with or without dust on top) — CTA is Reclaim; the
    // site's Safe-Burn toggle handles any dust once they're there.
    return { text: reply, keyboard: dustAccounts.length > 0 ? BURN_BUTTON : RECLAIM_BUTTON };
  } catch {
    return { text: "Couldn't scan that wallet right now. Try again in a moment." };
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

    // Anti-scam captcha: the join button encodes the new member's own id, so
    // only that person can pass their own check — a scammer can't tap someone
    // else's button to get let in.
    if (typeof callback.data === "string" && callback.data.startsWith("verify:")) {
      const targetId = Number(callback.data.slice("verify:".length));
      try {
        if (chatId && callback.from?.id === targetId) {
          await restrictChatMember(chatId, targetId, UNMUTED_PERMISSIONS);
          await answerCallbackQuery(callback.id, "Verified — welcome! 🎉");
          if (messageId) await deleteTelegramMessage(chatId, messageId);
        } else {
          await answerCallbackQuery(callback.id, "This verification button isn't for you.");
        }
      } catch {
        // best-effort — e.g. the bot lost its admin/restrict rights
      }
      return NextResponse.json({ ok: true });
    }

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
  const chatType: string | undefined = message?.chat?.type;
  const text: string | undefined = message?.text;

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  // Someone joined a group → mute them and post a captcha only they can pass.
  // Bots (including this one being added) are skipped.
  const newMembers = message?.new_chat_members;
  if (Array.isArray(newMembers) && (chatType === "group" || chatType === "supergroup")) {
    for (const member of newMembers) {
      if (!member || member.is_bot) continue;
      try {
        await restrictChatMember(chatId, member.id, MUTED_PERMISSIONS);
        const name = typeof member.first_name === "string" ? member.first_name : "there";
        await sendTelegramMessage(
          chatId,
          `Welcome ${name}! 👋\n\nTap the button below to verify you're human and unlock the chat.\n\n⚠️ Anti-scam check: we will NEVER ask you to connect a wallet or sign anything to verify. If a "verification" ever asks for that, it's a scam.`,
          [[{ text: "✅ I'm human", callback_data: `verify:${member.id}` }]]
        );
      } catch {
        // best-effort — if the bot isn't an admin with restrict rights, skip
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Everything below is for private 1:1 chats only. Once the bot is a group
  // admin (required to restrict members) it receives every group message, so
  // reacting to normal group chatter here would spam the group — only the
  // join handling above runs in groups.
  if (chatType !== "private" || !text) {
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
      if (walletParam) {
        const { text: reply, keyboard } = await checkWallet(walletParam);
        await sendTelegramMessage(chatId, reply, keyboard);
      } else {
        await sendTelegramMessage(chatId, "Usage: /check <wallet address>");
      }
    } else if (command.startsWith("/")) {
      await sendTelegramMessage(chatId, "Unknown command. Try /help to see what I can do.");
    } else if (rest.length === 0 && isSolanaAddress(command)) {
      // No command prefix needed — a bare wallet address is enough.
      const { text: reply, keyboard } = await checkWallet(command);
      await sendTelegramMessage(chatId, reply, keyboard);
    } else {
      await sendTelegramMessage(chatId, "Send a wallet address, or try /help to see what I can do.");
    }
  } catch {
    // Best-effort — never fail the webhook ack over a delivery hiccup,
    // Telegram would just retry the same update.
  }

  return NextResponse.json({ ok: true });
}
