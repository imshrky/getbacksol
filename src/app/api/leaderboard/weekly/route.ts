import { NextResponse } from "next/server";
import { getCurrentWeekWindow, getWeeklyRankings, getWeeklyPrizePoolLamports } from "@/lib/leaderboard";

/**
 * Public live leaderboard for the week in progress. No auth — wallet
 * addresses and reclaim activity aren't secret, same trust level as
 * /api/reclaims/history.
 */
export async function GET() {
  try {
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
