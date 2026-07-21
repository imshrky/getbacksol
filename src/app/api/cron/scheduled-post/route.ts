import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/xClient";
import { postToTelegram } from "@/lib/telegramClient";
import { SCHEDULED_POSTS } from "@/lib/scheduledPosts";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Used to build a link back to the tweet we just published, so Telegram
// subscribers can like/retweet it rather than just read a copy of it.
const X_HANDLE = "GetBackSOL";

/**
 * Vercel Cron target (see vercel.json) — posts one promotional message every
 * 2 days. The rotation index is derived from the current date rather than
 * stored anywhere, so this route stays fully stateless: no database, no
 * "which post did we send last time" bookkeeping to get out of sync.
 *
 * Each published tweet is also mirrored to the Telegram channel — one write-up
 * reaching both audiences, instead of maintaining separate copy for each.
 * (/api/cron/telegram-post still posts its own subscriber-oriented content on
 * its own schedule; this is additional, not a replacement.)
 *
 * Protected by CRON_SECRET: Vercel automatically sends it as a Bearer token
 * on scheduled invocations, so a request without a matching header is
 * rejected — otherwise this URL would be a public, unauthenticated way to
 * spend real money on X API calls.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayIndex = Math.floor(Date.now() / MS_PER_DAY);
  const text = SCHEDULED_POSTS[dayIndex % SCHEDULED_POSTS.length];

  try {
    const { id } = await postTweet(text);

    // Best-effort mirror, deliberately isolated from the tweet above: the
    // tweet has already gone out by this point, so a Telegram failure must
    // never surface as an error here — a non-2xx would let Vercel retry the
    // whole route and publish the same tweet twice.
    let mirroredToTelegram = false;
    try {
      await postToTelegram(`${text}\n\nhttps://x.com/${X_HANDLE}/status/${id}`);
      mirroredToTelegram = true;
    } catch {
      // swallow — mirroring is a bonus, not part of this route succeeding
    }

    return NextResponse.json({ posted: true, id, text, mirroredToTelegram });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to post." },
      { status: 500 }
    );
  }
}
