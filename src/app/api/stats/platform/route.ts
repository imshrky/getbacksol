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
  } catch (e) {
    // Temporary: logging the real error to diagnose a DATABASE_URL issue —
    // remove once the underlying connection problem is confirmed fixed.
    console.error("getPlatformStats failed:", e);
    return NextResponse.json({ error: "Stats are temporarily unavailable." }, { status: 503 });
  }
}
