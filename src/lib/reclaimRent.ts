import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  createBurnInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { FEE_WALLET } from "./feeWallet";
import { RECLAIM_FEE_RATE } from "./mockTokens";
import type { RentAccount } from "./useRentAccounts";

// Instruction budget per transaction, not account count — a dust account
// costs 2 instructions (burn + close) instead of 1. Leaves one slot for the
// fee transfer, matching MAX_INSTRUCTIONS in /api/relay-close/route.ts.
const MAX_INSTRUCTIONS_PER_TX = 10;

const LAMPORTS_PER_SOL = 1_000_000_000;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Groups accounts into batches that fit the per-transaction instruction
 * budget, accounting for dust accounts costing 2 instructions (burn +
 * close) instead of 1.
 */
export function batchByInstructionBudget(accounts: RentAccount[]): RentAccount[][] {
  const batches: RentAccount[][] = [];
  let current: RentAccount[] = [];
  let currentCost = 0;

  for (const account of accounts) {
    const cost = account.needsBurn ? 2 : 1;
    if (current.length > 0 && currentCost + cost > MAX_INSTRUCTIONS_PER_TX) {
      batches.push(current);
      current = [];
      currentCost = 0;
    }
    current.push(account);
    currentCost += cost;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

/**
 * Builds one atomic transaction that closes every account in `batch` and
 * sends the platform's 15% fee to FEE_WALLET — the user receives the
 * remaining 85% automatically, since closeAccount pays the rent directly
 * to `owner` and the fee transfer only moves the cut on top of that.
 * Accounts with `needsBurn` get a burn instruction (for their exact
 * `rawAmount`) before the close, so a residual dust balance doesn't block
 * closeAccount's zero-balance requirement.
 *
 * `feePayer` is the platform's gasless relay wallet, not `owner` — the
 * owner only needs to sign to authorize closing their own accounts, never
 * needs to hold SOL themselves. See /api/relay-close for the other half.
 */
export function buildCloseAccountBatchTx(
  owner: PublicKey,
  feePayer: PublicKey,
  batch: RentAccount[]
): Transaction {
  const tx = new Transaction();
  tx.feePayer = feePayer;
  let lamports = 0;

  for (const account of batch) {
    const tokenAccount = new PublicKey(account.pubkey);
    const programId =
      account.programId === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : undefined;

    if (account.needsBurn) {
      if (!account.rawAmount) {
        throw new Error(`Missing rawAmount for dust account ${account.pubkey}`);
      }
      tx.add(
        createBurnInstruction(
          tokenAccount,
          new PublicKey(account.mint),
          owner,
          BigInt(account.rawAmount),
          [],
          programId
        )
      );
    }

    tx.add(createCloseAccountInstruction(tokenAccount, owner, owner, [], programId));
    lamports += Math.round(account.reclaimable * LAMPORTS_PER_SOL);
  }

  const feeLamports = Math.round(lamports * RECLAIM_FEE_RATE);
  if (feeLamports > 0) {
    tx.add(
      SystemProgram.transfer({ fromPubkey: owner, toPubkey: FEE_WALLET, lamports: feeLamports })
    );
  }

  return tx;
}
