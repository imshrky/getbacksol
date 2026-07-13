import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/xClient";
import { SCHEDULED_POSTS } from "@/lib/scheduledPosts";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Vercel Cron target (see vercel.json) — posts one promotional message every
 * 2 days. The rotation index is derived from the current date rather than
 * stored anywhere, so this route stays fully stateless: no database, no
 * "which post did we send last time" bookkeeping to get out of sync.
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
    return NextResponse.json({ posted: true, id, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to post." },
      { status: 500 }
    );
  }
}
