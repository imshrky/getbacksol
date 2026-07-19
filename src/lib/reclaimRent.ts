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

// Flat platform fee: a straight percentage of whatever's reclaimed, with no
// minimum floor — small reclaims just pay proportionally less, never a
// fixed cut that would eat most of a tiny account. Exported so
// /api/build-sell charges the exact same way.
export function feeLamportsFor(grossLamports: number): number {
  return Math.round(grossLamports * RECLAIM_FEE_RATE);
}

export type ReclaimSummary = { gross: number; fee: number; net: number };

/**
 * The exact gross/fee/net a selection will produce, exposed so the UI can
 * preview it before the user signs and so partner/bot estimates match what
 * `buildCloseAccountBatchTx` actually charges — one source of truth.
 */
export function calculateReclaimSummary(accounts: RentAccount[]): ReclaimSummary {
  const grossLamports = accounts.reduce(
    (sum, a) => sum + Math.round(a.reclaimable * LAMPORTS_PER_SOL),
    0
  );
  const feeLamports = feeLamportsFor(grossLamports);

  return {
    gross: grossLamports / LAMPORTS_PER_SOL,
    fee: feeLamports / LAMPORTS_PER_SOL,
    net: (grossLamports - feeLamports) / LAMPORTS_PER_SOL,
  };
}

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
 * sends the platform's fee to FEE_WALLET — a flat percentage of the batch's
 * gross (see feeLamportsFor / RECLAIM_FEE_RATE). The user receives whatever's
 * left automatically, since closeAccount pays the rent directly to `owner`
 * and the fee transfer only moves the cut on top of that. Accounts with
 * `needsBurn` get a burn instruction (for their exact
 * `rawAmount`) before the close, so a residual dust balance doesn't block
 * closeAccount's zero-balance requirement.
 *
 * `owner` is the fee payer too — not the platform's relay wallet, for
 * wider wallet compatibility (a transaction whose fee payer isn't the
 * connected account is a less common, less-tested pattern — see CLAUDE.md
 * for the Trust Wallet investigation this came out of, though that
 * specific wallet turned out to have a different, still-unresolved issue).
 * The relay tops the owner up with a few thousand lamports beforehand (see
 * /api/relay-topup) so they can pay their own tiny network fee here. Still
 * "gasless" from the user's
 * perspective — they never need to already hold SOL, they just receive a
 * dust amount of it moments before signing. See /api/relay-close for the
 * other half (this transaction ends up fully signed by `owner` alone, no
 * relay signature needed).
 */
export function buildCloseAccountBatchTx(owner: PublicKey, batch: RentAccount[]): Transaction {
  const tx = new Transaction();
  tx.feePayer = owner;
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

  const feeLamports = feeLamportsFor(lamports);
  if (feeLamports > 0) {
    tx.add(
      SystemProgram.transfer({ fromPubkey: owner, toPubkey: FEE_WALLET, lamports: feeLamports })
    );
  }

  return tx;
}
