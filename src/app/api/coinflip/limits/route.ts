import { NextResponse } from "next/server";
import { Connection, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { FEE_WALLET } from "@/lib/feeWallet";
import { maxAffordableWagerLamports } from "@/lib/coinflipConfig";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

/**
 * How large a wager the house can currently cover, so the UI can grey out
 * stakes it couldn't pay out on. This exists because the bankroll check in
 * /api/coinflip/resolve necessarily runs *after* the player's wager has
 * already confirmed on-chain: without a warning up front, a player could
 * pay for a round that then can't be resolved. Matters far more with degen
 * stakes, where a single payout can exceed the whole float.
 *
 * Only ever exposes a derived ceiling, never the wallet's raw balance.
 */
export async function GET() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
    const connection = new Connection(endpoint, "confirmed");
    const balance = await connection.getBalance(FEE_WALLET);
    return NextResponse.json(
      { maxWagerLamports: maxAffordableWagerLamports(balance) },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch {
    // Unknown capacity: the client treats null as "let the server decide"
    // rather than blocking play outright.
    return NextResponse.json({ maxWagerLamports: null }, { status: 503 });
  }
}
