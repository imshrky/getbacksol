import { NextRequest, NextResponse } from "next/server";
import { postTweet, searchRecentTweets } from "@/lib/xClient";
import { pickRandomReply } from "@/lib/replyTemplates";

export const maxDuration = 60;

const SEARCH_QUERY =
  '(solana rent OR "dust tokens" OR "empty token account" OR "reclaim rent" OR "wallet is full of tokens") lang:en -is:retweet -is:reply';

const MAX_REPLIES_PER_RUN = 5;
// Vercel Hobby cron only allows once-daily runs, and can fire anywhere
// within the scheduled hour (up to ~59 min of jitter). 22h (not 24h) leaves
// a safety margin so this run's search window never overlaps yesterday's —
// the whole de-duplication strategy, no database needed. Costs a small gap
// of uncovered time instead of ever risking a double-reply.
const WINDOW_HOURS = 22;

/**
 * Vercel Cron target (once daily, see vercel.json) — searches recent tweets
 * matching Solana-rent-related keywords and replies to a handful of them.
 * Replies never include a URL (X charges $0.20/post with a link vs $0.015
 * without) — the account's bio carries the actual link.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  let candidates: { id: string; text: string; author_id: string }[];
  try {
    candidates = await searchRecentTweets(SEARCH_QUERY, 10, startTime);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed." },
      { status: 500 }
    );
  }

  const toReplyTo = candidates.slice(0, MAX_REPLIES_PER_RUN);
  const results: { id: string; replied: boolean; error?: string }[] = [];

  for (const tweet of toReplyTo) {
    try {
      await postTweet(pickRandomReply(), tweet.id);
      results.push({ id: tweet.id, replied: true });
    } catch (e) {
      results.push({ id: tweet.id, replied: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return NextResponse.json({
    scanned: candidates.length,
    repliedTo: results.filter((r) => r.replied).length,
    results,
  });
}
