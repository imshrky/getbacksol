import { NextResponse } from "next/server";
import { getReclaimHistory } from "@/lib/reclaims";

/**
 * Public feed of recent reclaim transactions across the whole platform —
 * no auth, since every field here (wallet address, amount, signature) is
 * already independently verifiable on any Solana block explorer.
 */
export async function GET() {
  try {
    const history = await getReclaimHistory(20);
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ error: "Reclaim history is temporarily unavailable." }, { status: 503 });
  }
}
