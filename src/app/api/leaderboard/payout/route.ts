import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { FEE_WALLET } from "@/lib/feeWallet";
import { getPendingPayout, recordWeeklyPayout } from "@/lib/leaderboard";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
// Generous ceiling on the network fee FEE_WALLET can have paid on top of the
// three payout transfers — guards against a transaction that moves far more
// than the expected payout without hand-decoding every instruction (same
// balance-delta approach recordReclaim already uses for net amounts).
const MAX_NETWORK_FEE_LAMPORTS = 100_000n;

/**
 * The current pending weekly prize payout, if any — the admin page polls
 * this to know who to pay and how much. Never trusts a client-supplied
 * amount; always recomputed from the database.
 */
export async function GET() {
  try {
    const pending = await getPendingPayout();
    return NextResponse.json({ pending });
  } catch {
    return NextResponse.json({ error: "Could not load pending payout." }, { status: 503 });
  }
}

/**
 * Records a weekly prize payout after independently verifying it actually
 * happened on-chain — the client only ever supplies a transaction
 * signature, never amounts or winners. Whoever holds the FEE_WALLET private
 * key signs and sends the payment themselves (the app never holds that
 * key); this endpoint's only job is to confirm the signed transaction
 * matches what's actually owed before writing it to the ledger.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const signature = body?.signature;
  if (typeof signature !== "string" || signature.length === 0) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const pending = await getPendingPayout();
  if (!pending) {
    return NextResponse.json({ error: "Nothing pending — already paid or no activity last week." }, { status: 400 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  const details = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!details || details.meta?.err) {
    return NextResponse.json({ error: "Transaction not found or failed." }, { status: 400 });
  }

  const accountKeys = details.transaction.message.getAccountKeys().staticAccountKeys;
  const feeWalletIndex = accountKeys.findIndex((k) => k.equals(FEE_WALLET));
  if (feeWalletIndex !== 0) {
    return NextResponse.json({ error: "FEE_WALLET must be the transaction's fee payer." }, { status: 400 });
  }

  const feeWalletDelta =
    BigInt(details.meta!.postBalances[feeWalletIndex]) - BigInt(details.meta!.preBalances[feeWalletIndex]);
  const expectedTotal = pending.winners.reduce((sum, w) => sum + BigInt(w.amountLamports), 0n);
  if (-feeWalletDelta < expectedTotal || -feeWalletDelta > expectedTotal + MAX_NETWORK_FEE_LAMPORTS) {
    return NextResponse.json({ error: "Transaction amount doesn't match the expected payout." }, { status: 400 });
  }

  for (const winner of pending.winners) {
    let winnerPubkey: PublicKey;
    try {
      winnerPubkey = new PublicKey(winner.wallet);
    } catch {
      return NextResponse.json({ error: "Invalid winner address." }, { status: 500 });
    }
    const winnerIndex = accountKeys.findIndex((k) => k.equals(winnerPubkey));
    if (winnerIndex === -1) {
      return NextResponse.json({ error: `Winner ${winner.wallet} not paid in this transaction.` }, { status: 400 });
    }
    const delta = BigInt(details.meta!.postBalances[winnerIndex]) - BigInt(details.meta!.preBalances[winnerIndex]);
    if (delta !== BigInt(winner.amountLamports)) {
      return NextResponse.json({ error: `Winner ${winner.wallet} received the wrong amount.` }, { status: 400 });
    }
  }

  for (const winner of pending.winners) {
    await recordWeeklyPayout(
      pending.weekStart,
      winner.rank,
      winner.wallet,
      winner.xp,
      BigInt(winner.amountLamports),
      signature
    );
  }

  return NextResponse.json({ ok: true });
}
