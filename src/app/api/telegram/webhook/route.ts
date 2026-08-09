import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  muteChatMember,
  unmuteChatMember,
  deleteTelegramMessage,
  type InlineKeyboard,
} from "@/lib/telegramClient";
import { FAQ_ITEMS } from "@/lib/faqContent";
import { calculateReclaimSummary } from "@/lib/reclaimRent";
import {
  subscribeWalletAlert,
  getChatSubscriptions,
  unsubscribeWalletAlert,
} from "@/lib/walletAlerts";

const LAMPORTS_PER_SOL = 1_000_000_000;

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const SITE_URL = "https://getbacksol.com";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "getbacksolbot";

// Turnstile is the real anti-bot check; it's only active once both keys are
// configured on Vercel. Until then the bot falls back to a lightweight emoji
// captcha so joins are still gated, just less strongly.
const TURNSTILE_ENABLED =
  !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Emoji-captcha pool (fallback). Distinct entries so exactly one option in a
// challenge matches the target.
const EMOJI_POOL = ["🐶", "🐱", "🦊", "🐼", "🐵", "🐸", "🦁", "🐯", "🐨", "🐷", "🐮", "🐔", "🐧", "🦉", "🐝", "🦋"];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a "tap the 🐶" challenge whose buttons carry the joiner's own id, so
// only they can answer it. The correct button is flagged `1`, the rest `0`.
function buildEmojiCaptcha(userId: number, name: string): { text: string; keyboard: InlineKeyboard } {
  const options = shuffle(EMOJI_POOL).slice(0, 6);
  const target = options[Math.floor(Math.random() * options.length)];
  const buttons = options.map((emoji) => ({
    text: emoji,
    callback_data: `cap:${userId}:${emoji === target ? "1" : "0"}`,
  }));
  const text = `Welcome ${name}! 👋\n\nQuick anti-bot check — tap the ${target} below to unlock the chat.\n\n⚠️ We will NEVER ask you to connect a wallet or sign anything to verify. Anyone who does is a scammer.`;
  return { text, keyboard: [buttons.slice(0, 3), buttons.slice(3, 6)] };
}

const MAIN_KEYBOARD: InlineKeyboard = [
  [{ text: "🔍 Scan my wallet", url: SITE_URL }],
  [
    { text: "💰 Check a wallet", callback_data: "prompt_check" },
    { text: "📖 FAQ", callback_data: "show_faq" },
  ],
  [
    { text: "🔔 My alerts", callback_data: "alerts_list" },
    { text: "🆘 Help", callback_data: "show_help" },
  ],
];

const BACK_KEYBOARD: InlineKeyboard = [[{ text: "⬅️ Back", callback_data: "back_to_menu" }]];

const WELCOME_TEXT =
  "Welcome to GetBackSOL 👋\n\nEvery empty token account in your Solana wallet is still holding a small SOL deposit. We help you get it back.\n\nPick an option below, or just send a wallet address any time.";

const HELP_TEXT =
  "Here's what I can do:\n\nJust send me a wallet address, no command needed, and I'll tell you how much SOL it can reclaim. No wallet connection required.\n\n/scan: link to the full app to actually connect a wallet and reclaim\n/alerts: see and manage the wallets I'm watching for you\n/faq: frequently asked questions\n\nEverything here is read-only and non-custodial. I never ask for a private key or seed phrase, and neither does the website.";

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

function shortAddr(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

// The "My alerts" view: the wallets this chat is subscribed to, each with a
// one-tap turn-off button. Used both by the /alerts command and the menu
// button, and re-rendered after a turn-off so the list stays in sync.
async function alertsListView(chatId: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const wallets = await getChatSubscriptions(chatId);
  if (wallets.length === 0) {
    return {
      text: "🔕 You have no wallet alerts set up.\n\nConnect your wallet on the site and tap “Get Telegram alerts” — I'll then watch it and ping you here whenever it has new reclaimable SOL.",
      keyboard: [
        [{ text: "🔍 Open GetBackSOL", url: SITE_URL }],
        [{ text: "⬅️ Back", callback_data: "back_to_menu" }],
      ],
    };
  }
  const lines = wallets.map((w) => `• ${shortAddr(w)}`).join("\n");
  const text = `🔔 I'm watching ${wallets.length} wallet${wallets.length === 1 ? "" : "s"} for you:\n\n${lines}\n\nYou'll get a message here whenever one has new reclaimable SOL. Tap a wallet below to turn its alerts off.`;
  // callback_data caps at 64 bytes; "alerts_off:" (11) + a base58 address (≤44)
  // stays well under. Cap the list at 10 buttons to keep the keyboard sane.
  const keyboard: InlineKeyboard = wallets
    .slice(0, 10)
    .map((w) => [{ text: `🔕 Turn off ${shortAddr(w)}`, callback_data: `alerts_off:${w}` }]);
  keyboard.push([{ text: "⬅️ Back", callback_data: "back_to_menu" }]);
  return { text, keyboard };
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

    // Emoji-captcha answer (fallback path). The button encodes the joiner's
    // own id and whether it's the right emoji, so only they can answer, and a
    // wrong tap just leaves them muted to try again — no one else's check can
    // be passed on their behalf.
    if (typeof callback.data === "string" && callback.data.startsWith("cap:")) {
      const [, uidStr, correct] = callback.data.split(":");
      const targetId = Number(uidStr);
      try {
        if (!chatId || callback.from?.id !== targetId) {
          await answerCallbackQuery(callback.id, "This verification isn't for you.");
        } else if (correct === "1") {
          await unmuteChatMember(chatId, targetId);
          await answerCallbackQuery(callback.id, "Verified — welcome! 🎉");
          if (messageId) await deleteTelegramMessage(chatId, messageId);
        } else {
          await answerCallbackQuery(callback.id, "❌ Wrong one — look again and tap the right emoji.");
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
        else if (callback.data === "alerts_list") {
          const view = await alertsListView(chatId);
          await editTelegramMessage(chatId, messageId, view.text, view.keyboard);
        } else if (typeof callback.data === "string" && callback.data.startsWith("alerts_off:")) {
          const wallet = callback.data.slice("alerts_off:".length);
          await unsubscribeWalletAlert(chatId, wallet);
          // Re-render the (now shorter) list so the change is visible.
          const view = await alertsListView(chatId);
          await editTelegramMessage(chatId, messageId, view.text, view.keyboard);
        }
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

  // Someone joined a group → mute them and post a verification only they can
  // pass. Bots (including this one being added) are skipped.
  const newMembers = message?.new_chat_members;
  if (Array.isArray(newMembers) && (chatType === "group" || chatType === "supergroup")) {
    for (const member of newMembers) {
      if (!member || member.is_bot) continue;
      try {
        await muteChatMember(chatId, member.id);
        const name = typeof member.first_name === "string" ? member.first_name : "there";

        if (TURNSTILE_ENABLED) {
          // web_app buttons aren't allowed in groups, so send them into a DM
          // with the bot (carrying this group's id) where the Mini App can
          // open — see the /start verify_ handler below. The message's own id
          // is baked into the deep-link too (via a follow-up edit, since it
          // isn't known until after sending) so the backend can delete this
          // prompt once the member is verified.
          const welcomeText = `Welcome ${name}! 👋\n\nTo unlock the chat, tap below to complete a quick human check with the bot.\n\n⚠️ It will NEVER ask you to connect a wallet or sign anything. Anyone who does is a scammer.`;
          const sent = await sendTelegramMessage(chatId, welcomeText, [
            [{ text: "🔓 Verify I'm human", url: `https://t.me/${BOT_USERNAME}?start=verify_${chatId}` }],
          ]);
          if (sent.messageId) {
            await editTelegramMessage(chatId, sent.messageId, welcomeText, [
              [
                {
                  text: "🔓 Verify I'm human",
                  url: `https://t.me/${BOT_USERNAME}?start=verify_${chatId}_${sent.messageId}`,
                },
              ],
            ]);
          }
        } else {
          const { text: capText, keyboard } = buildEmojiCaptcha(member.id, name);
          await sendTelegramMessage(chatId, capText, keyboard);
        }
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
      // Deep-link from a group's verify button: open the captcha Mini App,
      // carrying the group id so the backend knows where to unmute (see
      // /api/telegram/verify). web_app buttons are allowed here in the DM.
      const payload = rest[0];
      if (TURNSTILE_ENABLED && payload?.startsWith("verify_")) {
        // Payload is verify_<groupChatId> or verify_<groupChatId>_<messageId>.
        // The group id has no underscore (it's a signed number), so the last
        // underscore, if any, separates the welcome message's id — passed on
        // so the backend can delete that prompt after verification.
        const rest2 = payload.slice("verify_".length);
        const usc = rest2.lastIndexOf("_");
        const groupChatId = usc > 0 ? rest2.slice(0, usc) : rest2;
        const promptMessageId = usc > 0 ? rest2.slice(usc + 1) : "";
        const verifyUrl =
          `${SITE_URL}/verify?chat=${encodeURIComponent(groupChatId)}` +
          (promptMessageId ? `&msg=${encodeURIComponent(promptMessageId)}` : "");
        await sendTelegramMessage(
          chatId,
          "One quick check to unlock the chat — tap below and solve the captcha. We never ask you to connect a wallet.",
          [[{ text: "🔓 Verify I'm human", web_app: { url: verifyUrl } }]]
        );
      } else if (payload?.startsWith("wallet_")) {
        // Deep-link from the site's "Get Telegram alerts" button: bind this
        // chat to the wallet so the alert cron (/api/cron/wallet-alerts) can
        // ping it when new reclaimable SOL shows up. This one tap is the only
        // user action needed — Telegram forbids a bot from messaging anyone who
        // hasn't started it, so opting in has to happen here.
        const walletParam = payload.slice("wallet_".length);
        if (isSolanaAddress(walletParam)) {
          // Baseline the subscription at whatever's reclaimable right now, so
          // the cron only alerts on *new* SOL rather than immediately
          // re-announcing what they already have. Best-effort: if the scan
          // fails we still subscribe (baseline stays 0, so the first cron run
          // just tells them their current amount — harmless).
          let baseline = 0n;
          try {
            const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
            const connection = new Connection(endpoint, "confirmed");
            const { accounts, dustAccounts } = await scanWalletForRentAccounts(
              connection,
              new PublicKey(walletParam)
            );
            const totalSol = [...accounts, ...dustAccounts].reduce((s, a) => s + a.reclaimable, 0);
            baseline = BigInt(Math.round(totalSol * LAMPORTS_PER_SOL));
          } catch {
            // keep baseline 0
          }
          await subscribeWalletAlert(chatId, walletParam, baseline);
          const short = `${walletParam.slice(0, 4)}…${walletParam.slice(-4)}`;
          await sendTelegramMessage(
            chatId,
            `🔔 Alerts on!\n\nI'll watch ${short} and message you here whenever it has new reclaimable SOL — no need to check yourself.\n\nReclaim anytime at ${SITE_URL}\n\nManage your alerts any time with /alerts.\n\n⚠️ I will NEVER ask you to connect a wallet or sign anything here. Anyone who does is a scammer.`,
            [
              [{ text: "💰 Reclaim now", url: SITE_URL }],
              [{ text: "🔕 Turn off alerts", callback_data: `alerts_off:${walletParam}` }],
            ]
          );
        } else {
          await sendTelegramMessage(chatId, WELCOME_TEXT, MAIN_KEYBOARD);
        }
      } else {
        await sendTelegramMessage(chatId, WELCOME_TEXT, MAIN_KEYBOARD);
      }
    } else if (command === "/help") {
      await sendTelegramMessage(chatId, HELP_TEXT);
    } else if (command === "/faq") {
      await sendTelegramMessage(chatId, faqText());
    } else if (command === "/alerts") {
      const view = await alertsListView(chatId);
      await sendTelegramMessage(chatId, view.text, view.keyboard);
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
