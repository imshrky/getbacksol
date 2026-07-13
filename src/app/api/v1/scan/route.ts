import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { scanWalletForRentAccounts } from "@/lib/scanWallet";
import { resolvePartner } from "@/lib/partnerAuth";
import { RECLAIM_FEE_RATE } from "@/lib/mockTokens";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

/**
 * Partner API v1 — read-only wallet scan. Lets a partner show "you have X
 * SOL to reclaim" in their own UI without reimplementing our scanning
 * logic. Does not build or submit any transaction: the partner's own
 * frontend still has to get their user's wallet to sign, same non-custodial
 * requirement as the rest of GetBackSOL. That part (submitting through our
 * gasless relay on a partner's behalf, with fee-share attribution) is a
 * deliberate v2 — this endpoint only needs to prove out auth + the shared
 * scan function before that gets built.
 *
 * Auth: X-API-Key header, checked against a small partner registry (see
 * partnerAuth.ts). No rate limiting yet — there are no real partners to
 * rate-limit against; add it once there's real traffic to protect.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const partnerId = resolvePartner(apiKey);
  if (!partnerId) {
    return NextResponse.json({ error: "Invalid or missing X-API-Key." }, { status: 401 });
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

    const grossReclaimable = accounts.reduce((sum, a) => sum + a.reclaimable, 0);
    const netReclaimable = grossReclaimable * (1 - RECLAIM_FEE_RATE);

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
