import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAffiliateStats } from "@/lib/partners";

/**
 * Public read-only stats for a wallet's own referral link
 * (`?ref=<address>`). No auth — a wallet's referral earnings are keyed by
 * its own public address, the same trust level as looking up any wallet's
 * balance on a block explorer. Returns zeros for a wallet that has never
 * referred anyone rather than 404ing, since that's the common case (no
 * signup exists to have "not happened" yet).
 */
export async function GET(req: NextRequest) {
  const walletParam = req.nextUrl.searchParams.get("wallet");
  if (!walletParam) {
    return NextResponse.json({ error: "Missing 'wallet' query parameter." }, { status: 400 });
  }

  try {
    new PublicKey(walletParam);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  try {
    const stats = await getAffiliateStats(walletParam);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json(
      { error: "Affiliate stats are temporarily unavailable." },
      { status: 503 }
    );
  }
}
