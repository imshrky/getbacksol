import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import { resolvePartnerByApiKey } from "@/lib/partners";
import { checkScanRateLimit } from "@/lib/rateLimit";
import { RECLAIM_FEE_RATE } from "@/lib/mockTokens";
import { calculateReclaimSummary } from "@/lib/reclaimRent";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

/**
 * Partner API v1 — read-only wallet scan. Lets a partner show "you have X
 * SOL to reclaim" in their own UI without reimplementing our scanning
 * logic. Does not build or submit any transaction — the partner links out
 * to getbacksol.com (with a `?ref=` attribution tag) for the user to
 * connect their own wallet and execute through our existing gasless relay.
 * That keeps the actual money-moving surface exactly as it is today; a
 * partner's key only ever grants this read-only lookup, never transaction
 * submission. Revenue-share bookkeeping happens on the relay side (see
 * /api/relay-close) once a referred transaction actually confirms.
 *
 * Auth: X-API-Key header, resolved against the partners table (see
 * partners.ts). Partners self-provision a key at /partners — no manual
 * review — so every key is also rate limited (see rateLimit.ts) to bound
 * how hard a single key can hit this endpoint.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const partner = await resolvePartnerByApiKey(apiKey);
  if (!partner) {
    return NextResponse.json({ error: "Invalid or missing X-API-Key." }, { status: 401 });
  }

  const withinLimit = await checkScanRateLimit(partner.id);
  if (!withinLimit) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  const walletParam = req.nextUrl.searchParams.get("wallet");
  if (!walletParam) {
    return NextResponse.json({ error: "Missing 'wallet' query parameter." }, { status: 400 });
  }

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletParam);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  try {
    const { accounts, dustAccounts } = await scanWalletForRentAccounts(connection, wallet);

    // Same flat-rate fee math the actual close transaction applies, via the
    // shared helper — so a partner's estimate never drifts from what the
    // reclaim will really net.
    const { gross: grossReclaimable, net: netReclaimable } = calculateReclaimSummary(accounts);

    return NextResponse.json({
      wallet: walletParam,
      network: NETWORK,
      feeRate: RECLAIM_FEE_RATE,
      closable: {
        count: accounts.length,
        grossReclaimable,
        netReclaimable,
        accounts,
      },
      dust: {
        count: dustAccounts.length,
        accounts: dustAccounts,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scan failed." },
      { status: 500 }
    );
  }
}
