import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction, SystemProgram, clusterApiUrl, type Cluster } from "@solana/web3.js";
import { createCloseAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getFeePayerKeypair } from "@/lib/feePayer";
import { FEE_WALLET } from "@/lib/feeWallet";
import { RECLAIM_FEE_RATE } from "@/lib/mockTokens";
import { getSellRoute } from "@/lib/jupiter";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const MAX_LEGACY_TX_BYTES = 1232;

/**
 * Builds (but does not sign or submit) a Sell transaction for one dust
 * account: Jupiter's swap instructions to convert it to native SOL, plus
 * our own closeAccount and 15% fee transfer — same fee model as a plain
 * close, computed from the account's own rent reserve, not from swap
 * proceeds (the owner keeps 100% of whatever the sale yields).
 *
 * The client signs what this returns and posts it to /api/relay-close for
 * the fee payer's co-signature and submission, same as every other
 * reclaim transaction.
 */
export async function POST(req: NextRequest) {
  let feePayer;
  try {
    feePayer = getFeePayerKeypair();
  } catch {
    return NextResponse.json({ error: "Gasless relay is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { owner: ownerParam, tokenAccount: tokenAccountParam, mint: mintParam, rawAmount, programId: programIdParam } =
    body ?? {};

  if (
    typeof ownerParam !== "string" ||
    typeof tokenAccountParam !== "string" ||
    typeof mintParam !== "string" ||
    typeof rawAmount !== "string"
  ) {
    return NextResponse.json({ error: "Missing account details." }, { status: 400 });
  }

  let owner: PublicKey;
  let tokenAccount: PublicKey;
  let mint: PublicKey;
  try {
    owner = new PublicKey(ownerParam);
    tokenAccount = new PublicKey(tokenAccountParam);
    mint = new PublicKey(mintParam);
  } catch {
    return NextResponse.json({ error: "Invalid account address." }, { status: 400 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  // Sanity check against on-chain state before spending a Jupiter API call
  // — not the fund-safety boundary (the swap instruction itself still
  // requires the true owner's signature), just avoids building
  // transactions for accounts that don't match what the caller claims.
  const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
  const parsedInfo = (
    accountInfo.value?.data as { parsed?: { info?: Record<string, unknown> } } | undefined
  )?.parsed?.info;
  const tokenAmount = parsedInfo?.tokenAmount as { amount?: string } | undefined;
  if (
    !parsedInfo ||
    parsedInfo.mint !== mint.toBase58() ||
    parsedInfo.owner !== owner.toBase58() ||
    tokenAmount?.amount !== rawAmount
  ) {
    return NextResponse.json({ error: "Account details don't match on-chain state." }, { status: 400 });
  }

  const route = await getSellRoute(mint.toBase58(), rawAmount, owner, feePayer.publicKey);
  if (!route) {
    return NextResponse.json({ error: "No viable sell route for this token." }, { status: 404 });
  }

  const tokenProgramId = programIdParam === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : undefined;

  const tx = new Transaction();
  tx.feePayer = feePayer.publicKey;
  for (const ix of route.instructions) tx.add(ix);
  tx.add(createCloseAccountInstruction(tokenAccount, owner, owner, [], tokenProgramId));

  const rentLamports = accountInfo.value?.lamports ?? 0;
  const feeLamports = Math.round(rentLamports * RECLAIM_FEE_RATE);
  if (feeLamports > 0) {
    tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: FEE_WALLET, lamports: feeLamports }));
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  if (serialized.length > MAX_LEGACY_TX_BYTES) {
    return NextResponse.json({ error: "Sell route too complex for one transaction." }, { status: 400 });
  }

  return NextResponse.json({
    transaction: serialized.toString("base64"),
    outAmount: route.guaranteedLamports.toString(),
  });
}
