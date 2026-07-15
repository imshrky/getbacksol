import { NextRequest, NextResponse } from "next/server";
import { postToTelegram } from "@/lib/telegramClient";
import { getTelegramPost } from "@/lib/telegramPosts";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Vercel Cron target (see vercel.json) — posts one message a day to the
 * GetBackSOL Telegram channel. Same stateless rotation pattern as
 * /api/cron/scheduled-post (day-index derived, no database), except the
 * Telegram Bot API has no per-message cost, so there's no reason to space
 * these out every 2 days the way the X posts are.
 *
 * Protected by CRON_SECRET — same shared secret as the other cron routes,
 * automatically sent as a Bearer token by Vercel on scheduled invocations.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayIndex = Math.floor(Date.now() / MS_PER_DAY);
  const text = await getTelegramPost(dayIndex);

  try {
    const { messageId } = await postToTelegram(text);
    return NextResponse.json({ posted: true, messageId, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to post." },
      { status: 500 }
    );
  }
}
