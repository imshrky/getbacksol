import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentWeekWindow,
  getWeeklyRankings,
  getWeeklyPrizePoolLamports,
  getAllTimeRankings,
} from "@/lib/leaderboard";

/**
 * Public live leaderboard. `?period=all-time` returns an unwindowed
 * "hall of fame" view with no pool/reset (informational only — the weekly
 * view is the only one with a real, payable prize pool). Anything else
 * defaults to the week in progress. No auth — wallet addresses and reclaim
 * activity aren't secret, same trust level as /api/reclaims/history.
 */
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") === "all-time" ? "all-time" : "week";

  try {
    if (period === "all-time") {
      const rankings = await getAllTimeRankings(20);
      return NextResponse.json({ resetAt: null, poolLamports: "0", rankings });
    }

    const window = getCurrentWeekWindow();
    const [rankings, poolLamports] = await Promise.all([
      getWeeklyRankings(window, 20),
      getWeeklyPrizePoolLamports(window),
    ]);
    return NextResponse.json({
      resetAt: window.weekEnd.toISOString(),
      poolLamports: String(poolLamports),
      rankings,
    });
  } catch {
    return NextResponse.json({ error: "Leaderboard is temporarily unavailable." }, { status: 503 });
  }
}
