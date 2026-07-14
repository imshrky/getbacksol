import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, SystemProgram, Transaction, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { getFeePayerKeypair } from "@/lib/feePayer";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
// One signature's base fee (5000 lamports) plus margin for a wallet-added
// priority fee — this only ever needs to cover network fees, never rent or
// anything the user keeps, so it stays a fixed, tiny, well-known amount.
const LAMPORTS_PER_TX_WITH_MARGIN = 10_000;
const MAX_TX_COUNT = 20;

/**
 * Tops the owner's wallet up with just enough SOL to pay their own network
 * fee on the reclaim transaction(s) they're about to sign — see
 * reclaimRent.ts for why the owner is the fee payer instead of the relay.
 * Fully server-signed, no wallet interaction: the owner never needs to
 * approve receiving a few thousand lamports. Skips the transfer entirely
 * if they already have enough (repeat users, or anyone who already holds
 * SOL), so this never sends more than what's actually needed.
 */
export async function POST(req: NextRequest) {
  let feePayer;
  try {
    feePayer = getFeePayerKeypair();
  } catch {
    return NextResponse.json({ error: "Gasless relay is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const count = Number(body?.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_TX_COUNT) {
    return NextResponse.json({ error: "Invalid transaction count." }, { status: 400 });
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(body?.owner);
  } catch {
    return NextResponse.json({ error: "Invalid owner address." }, { status: 400 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  const needed = count * LAMPORTS_PER_TX_WITH_MARGIN;
  const currentBalance = await connection.getBalance(owner);
  if (currentBalance >= needed) {
    return NextResponse.json({ skipped: true });
  }

  const topUpLamports = needed - currentBalance;
  const tx = new Transaction();
  tx.feePayer = feePayer.publicKey;
  tx.add(SystemProgram.transfer({ fromPubkey: feePayer.publicKey, toPubkey: owner, lamports: topUpLamports }));

  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(feePayer);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    return NextResponse.json({ signature });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not prepare network fees." },
      { status: 500 }
    );
  }
}
