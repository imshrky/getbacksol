import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegramAuth";
import { unmuteChatMember, deleteTelegramMessage } from "@/lib/telegramClient";

// Never cache: this route validates a fresh captcha token + Telegram session
// on every call and must run server-side each time.
export const dynamic = "force-dynamic";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Backend for the /verify Mini App. A new group member opens the Mini App,
 * solves the Cloudflare Turnstile captcha, and the page posts the resulting
 * token here together with Telegram's signed initData. We trust the unlock
 * only after BOTH check out:
 *   1. initData validates against the bot token — proves this is really that
 *      Telegram user, not a script forging a "passed" claim.
 *   2. The Turnstile token validates against Cloudflare — proves a human (not
 *      a bot) actually solved the challenge.
 * Only then is the member unmuted, and only ever themselves: the user id
 * comes from the verified initData, never from the request body.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!botToken || !turnstileSecret) {
    return NextResponse.json({ error: "Verification is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const token = body?.token;
  const initData = body?.initData;
  const chat = body?.chat;
  // Optional: the group's verification-prompt message id, to delete once done.
  const promptMessageId = Number(body?.msg);
  if (typeof token !== "string" || typeof initData !== "string" || typeof chat !== "string" || !chat) {
    return NextResponse.json({ error: "Missing verification data." }, { status: 400 });
  }

  // 1. Prove the Telegram session is genuine and get the real user id.
  const session = validateTelegramInitData(initData, botToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid Telegram session." }, { status: 401 });
  }

  // 2. Prove a human solved the captcha.
  let turnstileOk = false;
  try {
    const form = new URLSearchParams({ secret: turnstileSecret, response: token });
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    turnstileOk = json?.success === true;
  } catch {
    turnstileOk = false;
  }
  if (!turnstileOk) {
    return NextResponse.json({ error: "Captcha check failed. Please try again." }, { status: 403 });
  }

  // 3. Unmute — the id is from the verified session, so a user can only ever
  // unlock themselves, never someone else.
  try {
    await unmuteChatMember(chat, session.userId);
  } catch {
    return NextResponse.json(
      { error: "Verified, but couldn't unlock the chat. The bot may have lost its admin rights." },
      { status: 500 }
    );
  }

  // Clean up the group's verification prompt now that they're through — best
  // effort, never fails the unlock over a leftover message.
  if (Number.isFinite(promptMessageId) && promptMessageId > 0) {
    try {
      await deleteTelegramMessage(chat, promptMessageId);
    } catch {
      // leave it; the member is already unlocked
    }
  }

  return NextResponse.json({ ok: true });
}
