import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  ComputeBudgetProgram,
  clusterApiUrl,
  type Cluster,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getFeePayerKeypair } from "@/lib/feePayer";
import { FEE_WALLET } from "@/lib/feeWallet";

const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";
const CLOSE_ACCOUNT_DISCRIMINATOR = 9; // Token Program / Token-2022 `CloseAccount`
const BURN_DISCRIMINATOR = 8; // Token Program / Token-2022 `Burn` — Safe-Burn dust accounts
const SYSTEM_TRANSFER_DISCRIMINATOR = 2; // SystemProgram `Transfer`
// Wallets (confirmed with MetaMask) commonly prepend their own instructions
// before signing: compute-budget priority-fee instructions, and — for
// wallets that run a post-transaction balance guard — assertion
// instructions from that guard program. Neither takes custody of funds
// (ComputeBudget instructions carry no accounts at all; the guard program
// only asserts expected balances and reverts on mismatch, it can't move
// anything), so both are allow-listed alongside our own instructions rather
// than rejecting every transaction real wallets actually produce.
const GUARD_PROGRAM_ID = new PublicKey("L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95");
// Core: up to 10 instructions (burn+close pairs count double) + 1 fee
// transfer, matching MAX_INSTRUCTIONS_PER_TX in reclaimRent.ts. Plus
// headroom for wallet-injected compute-budget and guard instructions.
const MAX_INSTRUCTIONS = 30;

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
 * Co-signs and submits a gasless Reclaim Rent transaction. The client
 * partially signs (as the token account owner) and sends the serialized
 * transaction here; we add the platform fee-payer's signature and pay the
 * network fee. Strict validation below is the only thing standing between
 * this endpoint and someone using our fee-payer float to pay for arbitrary
 * transactions, so every instruction is checked against an explicit
 * allow-list before we sign anything.
 */
export async function POST(req: NextRequest) {
  let feePayer;
  try {
    feePayer = getFeePayerKeypair();
  } catch {
    return NextResponse.json({ error: "Gasless relay is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const b64 = body?.transaction;
  if (typeof b64 !== "string") {
    return NextResponse.json({ error: "Missing transaction." }, { status: 400 });
  }

  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(b64, "base64"));
  } catch {
    return NextResponse.json({ error: "Invalid transaction." }, { status: 400 });
  }

  if (!tx.feePayer || !tx.feePayer.equals(feePayer.publicKey)) {
    return NextResponse.json({ error: "Unexpected fee payer." }, { status: 400 });
  }

  if (tx.instructions.length === 0 || tx.instructions.length > MAX_INSTRUCTIONS) {
    return NextResponse.json({ error: "Unexpected instruction count." }, { status: 400 });
  }

  let hasCloseAccount = false;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(ComputeBudgetProgram.programId) || ix.programId.equals(GUARD_PROGRAM_ID)) {
      continue;
    }

    const isTokenProgram = ix.programId.equals(TOKEN_PROGRAM_ID) || ix.programId.equals(TOKEN_2022_PROGRAM_ID);
    const isSystemProgram = ix.programId.equals(SystemProgram.programId);

    if (isTokenProgram) {
      const discriminator = ix.data[0];
      if (
        ix.data.length < 1 ||
        (discriminator !== CLOSE_ACCOUNT_DISCRIMINATOR && discriminator !== BURN_DISCRIMINATOR)
      ) {
        return NextResponse.json(
          { error: "Only closeAccount and burn instructions are allowed." },
          { status: 400 }
        );
      }
      if (discriminator === CLOSE_ACCOUNT_DISCRIMINATOR) hasCloseAccount = true;
    } else if (isSystemProgram) {
      if (ix.data.length < 4 || ix.data.readUInt32LE(0) !== SYSTEM_TRANSFER_DISCRIMINATOR) {
        return NextResponse.json({ error: "Only transfer instructions are allowed." }, { status: 400 });
      }
      const destination = ix.keys[1]?.pubkey;
      if (!destination || !destination.equals(FEE_WALLET)) {
        return NextResponse.json({ error: "Unexpected transfer destination." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unexpected program in transaction." }, { status: 400 });
    }
  }

  if (!hasCloseAccount) {
    return NextResponse.json({ error: "No closeAccount instruction found." }, { status: 400 });
  }

  // Every signer except us must already have signed client-side.
  const missing = tx.signatures.filter((s) => s.signature === null);
  if (missing.length !== 1 || !missing[0].publicKey.equals(feePayer.publicKey)) {
    return NextResponse.json({ error: "Unexpected signature state." }, { status: 400 });
  }

  tx.partialSign(feePayer);

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint, "confirmed");

  try {
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await confirmSignature(connection, signature);
    return NextResponse.json({ signature });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transaction failed." },
      { status: 500 }
    );
  }
}
