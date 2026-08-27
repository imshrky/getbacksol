import { NextRequest, NextResponse } from "next/server";
import { Connection, SystemProgram, Transaction, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { getSql } from "@/lib/db";
import { FEE_WALLET } from "@/lib/feeWallet";
import { getFeeWalletKeypair } from "@/lib/feeWalletSigner";
import { COINFLIP_ALL_AMOUNTS_SOL, computeOutcome } from "@/lib/coinflip";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const LAMPORTS_PER_SOL = 1_000_000_000;
// Standard and degen stakes both count as valid wagers here; the UI
// decides which set a player is offered, the server just checks the amount
// that actually arrived is one of them.
const ALLOWED_WAGER_LAMPORTS = new Set(COINFLIP_ALL_AMOUNTS_SOL.map((s) => Math.round(s * LAMPORTS_PER_SOL)));
// Extra headroom on top of what a payout could cost, so a payout attempt
// never gets to "insufficient funds" mid-flight because of network fee
// variance — this is a bankroll-health check, not a real cost.
const PAYOUT_FEE_BUFFER_LAMPORTS = 50_000;

async function confirmSignature(connection: Connection, signature: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatus(signature);
    if (value?.err) throw new Error(JSON.stringify(value.err));
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Confirmation timed out.");
}

/**
 * Resolves a committed round: verifies the player's bet transaction really
 * happened on-chain (reading FEE_WALLET's actual balance delta, never a
 * client-supplied amount), computes the outcome from the seed already
 * committed at /commit time, pays out automatically on a win, and reveals
 * the server seed so the round can be independently re-verified.
 *
 * Every check here exists because this route is the one place on the whole
 * site where server-held key material moves money on its own — see
 * feeWalletSigner.ts.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const betTxSignature = body?.betTxSignature;
  const side = body?.side;
  const clientSeed = typeof body?.clientSeed === "string" ? body.clientSeed.slice(0, 200) : "";

  // `id` is a BIGSERIAL, which the Postgres driver hands back as a *string*
  // (bigints can exceed Number.MAX_SAFE_INTEGER), so /commit returns a
  // string and the client sends one back. Accept either shape and keep the
  // canonical string form: a number-only check here silently rejected every
  // real round with a 400 — after the player's wager had already landed
  // on-chain.
  const rawRoundId = body?.roundId;
  const roundId =
    typeof rawRoundId === "string" && /^\d+$/.test(rawRoundId)
      ? rawRoundId
      : typeof rawRoundId === "number" && Number.isInteger(rawRoundId) && rawRoundId > 0
        ? String(rawRoundId)
        : null;

  if (roundId === null || typeof betTxSignature !== "string" || (side !== "heads" && side !== "tails")) {
    return NextResponse.json({ error: "Missing or invalid round details." }, { status: 400 });
  }

  const sql = getSql();

  const rounds = await sql`SELECT * FROM coinflip_rounds WHERE id = ${roundId}`;
  const round = rounds[0];
  if (!round) {
    return NextResponse.json({ error: "Unknown round." }, { status: 404 });
  }
  if (round.resolved_at) {
    return NextResponse.json({ error: "This round was already resolved." }, { status: 409 });
  }

  const existingByTx = await sql`SELECT id FROM coinflip_rounds WHERE bet_tx_signature = ${betTxSignature}`;
  if (existingByTx.length > 0) {
    return NextResponse.json({ error: "This bet transaction was already used." }, { status: 409 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  const tx = await connection.getTransaction(betTxSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) {
    return NextResponse.json({ error: "Bet transaction not found or failed." }, { status: 400 });
  }

  const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;
  const feeWalletIndex = accountKeys.findIndex((k) => k.equals(FEE_WALLET));
  if (feeWalletIndex < 0 || !tx.meta) {
    return NextResponse.json({ error: "Bet transaction didn't pay FEE_WALLET." }, { status: 400 });
  }

  // Playing from the house wallet itself makes no sense: the wager would be
  // a self-transfer (so the balance delta below reads as a network fee, not
  // a wager) and any payout would pay the house itself. Caught explicitly
  // because it's an easy mistake to make while testing — FEE_WALLET is a
  // real personal wallet — and the failure downstream would otherwise be a
  // confusing "wrong wager size" error.
  if (accountKeys[0]?.equals(FEE_WALLET)) {
    return NextResponse.json(
      { error: "The house wallet can't play its own game. Connect a different wallet." },
      { status: 400 }
    );
  }

  // The real amount FEE_WALLET received — read from the confirmed balance
  // delta, never trusted from the client, same principle as relay-close's
  // fee validation.
  const wagerLamports = tx.meta.postBalances[feeWalletIndex] - tx.meta.preBalances[feeWalletIndex];
  if (!ALLOWED_WAGER_LAMPORTS.has(wagerLamports)) {
    return NextResponse.json({ error: "Bet amount isn't one of the allowed wager sizes." }, { status: 400 });
  }

  // Whoever signed and paid for this transaction is the player — the
  // "everyday" pattern used elsewhere on the site (the player pays their
  // own tiny network fee, so they're always index 0 / the fee payer).
  const owner = accountKeys[0];

  const payoutLamports = wagerLamports * 2;
  const feeWalletBalance = await connection.getBalance(FEE_WALLET);
  if (feeWalletBalance < payoutLamports + PAYOUT_FEE_BUFFER_LAMPORTS) {
    // The wager has already landed in FEE_WALLET at this point, but the
    // round is deliberately left unresolved (not marked as a loss) rather
    // than silently keeping it — this should be rare (keep FEE_WALLET
    // funded well above the max possible payout) and needs a manual
    // top-up + refund if it ever fires.
    return NextResponse.json(
      { error: "The house bankroll can't currently cover this payout. Contact support: your bet was received but not resolved." },
      { status: 503 }
    );
  }

  const serverSeed: string = round.server_seed;
  const outcome = computeOutcome(serverSeed, clientSeed, roundId);

  let payoutSignature: string | null = null;
  if (outcome === "win") {
    try {
      const feeWalletKeypair = getFeeWalletKeypair();
      const payoutTx = new Transaction();
      payoutTx.add(SystemProgram.transfer({ fromPubkey: FEE_WALLET, toPubkey: owner, lamports: payoutLamports }));
      payoutTx.feePayer = FEE_WALLET;
      const { blockhash } = await connection.getLatestBlockhash();
      payoutTx.recentBlockhash = blockhash;
      payoutTx.sign(feeWalletKeypair);
      payoutSignature = await connection.sendRawTransaction(payoutTx.serialize());
      await confirmSignature(connection, payoutSignature);
    } catch (e) {
      // The bet is already resolved as a win in the player's mind at this
      // point (the RNG outcome is fixed and about to be revealed) — record
      // it as a win with no payout signature so it's visibly a support
      // case, rather than silently downgrading it to a loss.
      await sql`
        UPDATE coinflip_rounds
        SET client_seed = ${clientSeed}, wallet = ${owner.toBase58()}, side = ${side},
            wager_lamports = ${wagerLamports}, bet_tx_signature = ${betTxSignature},
            outcome = ${outcome}, payout_lamports = ${payoutLamports}, resolved_at = now()
        WHERE id = ${roundId}
      `;
      return NextResponse.json(
        {
          error: e instanceof Error ? `Won, but payout failed: ${e.message}. Contact support.` : "Payout failed.",
        },
        { status: 500 }
      );
    }
  }

  await sql`
    UPDATE coinflip_rounds
    SET client_seed = ${clientSeed}, wallet = ${owner.toBase58()}, side = ${side},
        wager_lamports = ${wagerLamports}, bet_tx_signature = ${betTxSignature},
        outcome = ${outcome}, payout_lamports = ${outcome === "win" ? payoutLamports : 0},
        payout_tx_signature = ${payoutSignature}, resolved_at = now()
    WHERE id = ${roundId}
  `;

  return NextResponse.json({
    outcome,
    wagerLamports,
    payoutLamports: outcome === "win" ? payoutLamports : 0,
    payoutSignature,
    serverSeed,
    commitHash: round.commit_hash,
  });
}
