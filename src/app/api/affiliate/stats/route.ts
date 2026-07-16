import { NextRequest, NextResponse } from "next/server";
import { getAffiliateStats } from "@/lib/partners";

/**
 * Public read-only stats for any partner's earnings, keyed by their
 * `partner_id` — a wallet address for wallet-affiliates (`?ref=<address>`),
 * or a self-service slug for API partners signed up at /partners. No auth —
 * this id is already public the moment it's shared as a referral link, the
 * same trust level as looking up any wallet's balance on a block explorer.
 * Deliberately doesn't validate the param as a Solana address: it's an
 * opaque lookup key, not necessarily a wallet, and getAffiliateStats
 * already returns zeros for an id that's never referred anyone rather than
 * erroring — the common case for a name that just doesn't exist yet.
 */
export async function GET(req: NextRequest) {
  const walletParam = req.nextUrl.searchParams.get("wallet");
  if (!walletParam) {
    return NextResponse.json({ error: "Missing 'wallet' query parameter." }, { status: 400 });
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
