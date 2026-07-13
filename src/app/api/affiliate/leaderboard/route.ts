import { NextResponse } from "next/server";
import { getAffiliateLeaderboard } from "@/lib/partners";

/**
 * Public top-5 wallet affiliates by total earned. No auth — wallet
 * addresses aren't secret, and this is meant to be shown on the site as a
 * perk/incentive, not a private dashboard.
 */
export async function GET() {
  try {
    const leaderboard = await getAffiliateLeaderboard(5);
    return NextResponse.json({ leaderboard });
  } catch {
    return NextResponse.json({ error: "Leaderboard is temporarily unavailable." }, { status: 503 });
  }
}
