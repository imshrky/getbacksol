import { NextResponse } from "next/server";
import { getRecentFlips } from "@/lib/coinflip";

export async function GET() {
  try {
    const flips = await getRecentFlips(30);
    return NextResponse.json({ flips });
  } catch {
    return NextResponse.json({ error: "Recent flips are temporarily unavailable." }, { status: 503 });
  }
}
