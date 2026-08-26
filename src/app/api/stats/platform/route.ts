import { NextResponse } from "next/server";
import { getPlatformStats } from "@/lib/reclaims";

/**
 * Public all-time platform totals — powers the homepage's ImpactStats.
 * No auth, same trust level as /api/reclaims/history.
 */
export async function GET() {
  try {
    const stats = await getPlatformStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Stats are temporarily unavailable." }, { status: 503 });
  }
}
