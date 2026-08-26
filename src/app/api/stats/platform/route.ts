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
    // TEMPORARY DIAGNOSTIC — remove once the DATABASE_URL connection issue
    // is fixed. Surfaces the driver's own error code/message in the response
    // because Vercel's log viewer isn't showing console output for this
    // route. Any credentials that could appear inside a connection string
    // are stripped before anything is returned.
    console.error("getPlatformStats failed:", e);
    const err = e as { code?: string; message?: string; name?: string };
    const redact = (s: string) => s.replace(/\/\/[^@\s]*@/g, "//***:***@");
    return NextResponse.json(
      {
        error: "Stats are temporarily unavailable.",
        diagnostic: {
          name: err?.name ?? null,
          code: err?.code ?? null,
          message: err?.message ? redact(String(err.message)).slice(0, 300) : null,
        },
      },
      { status: 503 }
    );
  }
}
