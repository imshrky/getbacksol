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
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getFeePayerKeypair } from "@/lib/feePayer";
import { FEE_WALLET } from "@/lib/feeWallet";
import { partnerExists, resolveOrCreateWalletAffiliate, recordReferral } from "@/lib/partners";
import { recordReclaim } from "@/lib/reclaims";

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
// Jupiter's own aggregator program (see /api/build-sell) — well-known,
// heavily audited, trusted the same way Token/System program instruction
// shapes already are: we don't parse its instruction data, only bound how
// many of its instructions (and any Associated Token Account instruction,
// which pays real rent) can appear per transaction.
const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
// A legitimate Sell transaction (see build-sell/route.ts) needs at most one
// of each — capping here bounds the worst case a tampered client could
// achieve to roughly one rent-exempt reserve (~0.002 SOL), regardless of
// instruction content, since account-creation rent is a network constant,
// not something instruction data can inflate.
const MAX_JUPITER_INSTRUCTIONS = 1;
const MAX_ATA_INSTRUCTIONS = 1;
// Generous upper bound on how much the fee payer can pay out to the owner
// as guaranteed Sell proceeds in one transaction (see build-sell/route.ts)
// — real dust sales never come close to this; it's a backstop against a
// miscalculated or tampered payout amount, not a realistic ceiling.
const MAX_SELL_PAYOUT_LAMPORTS = 2_000_000_000n; // 2 SOL

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

  // Optional attribution tag, carried through from a `?ref=` link — either
  // a registered partner's id (see partnerExists) or, if that doesn't
  // match, any connected wallet's own address self-enrolling as an
  // affiliate on first use (see resolveOrCreateWalletAffiliate). Purely a
  // bookkeeping label either way: it never changes what the transaction is
  // allowed to do (the allow-list below is identical regardless), and the
  // fee amount credited is always read back from the validated transfer
  // instruction itself, never trusted from this field.
  const partnerId =
    typeof body?.partnerId === "string" && body.partnerId.length > 0 && body.partnerId.length <= 100
      ? body.partnerId
      : null;

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

  // The owner is whichever required signer isn't us — needed below to
  // recognize a legitimate Sell payout (fee payer -> owner), distinct from
  // our platform fee transfer (owner -> FEE_WALLET).
  const ownerEntry = tx.signatures.find((s) => !s.publicKey.equals(feePayer.publicKey));
  if (!ownerEntry) {
    return NextResponse.json({ error: "Unexpected signature state." }, { status: 400 });
  }
  const ownerPubkey = ownerEntry.publicKey;

  let hasCloseAccount = false;
  let feeLamports = 0n;
  let sellPayoutLamports = 0n;
  let jupiterCount = 0;
  let ataCount = 0;
  // Only counts closes that pay the owner directly — excludes the
  // Sell flow's internal WSOL-account close (destination = fee payer),
  // which isn't one of "their" accounts from the user's point of view.
  let accountsClosedForOwner = 0;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(ComputeBudgetProgram.programId) || ix.programId.equals(GUARD_PROGRAM_ID)) {
      continue;
    }

    if (ix.programId.equals(JUPITER_PROGRAM_ID)) {
      jupiterCount++;
      if (jupiterCount > MAX_JUPITER_INSTRUCTIONS) {
        return NextResponse.json({ error: "Too many swap instructions." }, { status: 400 });
      }
      continue;
    }

    if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      ataCount++;
      if (ataCount > MAX_ATA_INSTRUCTIONS) {
        return NextResponse.json({ error: "Too many account-creation instructions." }, { status: 400 });
      }
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
      if (discriminator === CLOSE_ACCOUNT_DISCRIMINATOR) {
        hasCloseAccount = true;
        if (ix.keys[1]?.pubkey?.equals(ownerPubkey)) accountsClosedForOwner++;
      }
    } else if (isSystemProgram) {
      if (ix.data.length < 4 || ix.data.readUInt32LE(0) !== SYSTEM_TRANSFER_DISCRIMINATOR) {
        return NextResponse.json({ error: "Only transfer instructions are allowed." }, { status: 400 });
      }
      const source = ix.keys[0]?.pubkey;
      const destination = ix.keys[1]?.pubkey;
      const lamports = ix.data.readBigUInt64LE(4);

      if (destination?.equals(FEE_WALLET)) {
        feeLamports += lamports;
      } else if (source?.equals(feePayer.publicKey) && destination?.equals(ownerPubkey)) {
        // Fee payer paying out guaranteed Sell proceeds (see
        // build-sell/route.ts) — bounded so a miscalculated or tampered
        // amount can't drain more than a dust sale ever plausibly yields.
        sellPayoutLamports += lamports;
        if (sellPayoutLamports > MAX_SELL_PAYOUT_LAMPORTS) {
          return NextResponse.json({ error: "Sell payout too large." }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Unexpected transfer source or destination." }, { status: 400 });
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

    if (partnerId && feeLamports > 0n) {
      // Best-effort bookkeeping only — the SOL has already moved on-chain
      // by this point, so a DB hiccup here must never surface as an error
      // to the user.
      try {
        const partner = (await partnerExists(partnerId)) ?? (await resolveOrCreateWalletAffiliate(partnerId));
        if (partner) await recordReferral(partner.id, signature, feeLamports, partner.revenueShare);
      } catch {
        // swallow — attribution is not part of the transaction's success
      }
    }

    // Public activity feed — every reclaim, not just referred ones. Reads
    // the owner's actual pre/post SOL balance from the confirmed
    // transaction rather than trying to compute it ourselves: closeAccount
    // releases whatever the account's real on-chain balance is at
    // execution time, which isn't encoded in the instruction itself.
    try {
      const details = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      const accountKeys = details?.transaction.message.getAccountKeys().staticAccountKeys;
      const ownerIndex = accountKeys?.findIndex((k) => k.equals(ownerPubkey)) ?? -1;
      if (details?.meta && ownerIndex >= 0) {
        const netLamports =
          BigInt(details.meta.postBalances[ownerIndex]) - BigInt(details.meta.preBalances[ownerIndex]);
        if (netLamports > 0n) {
          await recordReclaim(ownerPubkey.toBase58(), signature, accountsClosedForOwner, netLamports, feeLamports);
        }
      }
    } catch {
      // swallow — the activity feed is cosmetic, never the transaction's success
    }

    return NextResponse.json({ signature });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transaction failed." },
      { status: 500 }
    );
  }
}
