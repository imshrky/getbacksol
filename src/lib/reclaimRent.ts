import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createCloseAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { FEE_WALLET } from "./feeWallet";
import { RECLAIM_FEE_RATE } from "./mockTokens";
import type { RentAccount } from "./useRentAccounts";

// Conservative batch size to stay under the ~1232 byte transaction limit
// once compute budget + fee-transfer instructions are added.
export const MAX_ACCOUNTS_PER_TX = 10;

const LAMPORTS_PER_SOL = 1_000_000_000;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Builds one atomic transaction that closes every account in `batch` and
 * sends the platform's 15% fee to FEE_WALLET — the user receives the
 * remaining 85% automatically, since closeAccount pays the rent directly
 * to `owner` and the fee transfer only moves the cut on top of that.
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
    tx.add(
      createCloseAccountInstruction(
        new PublicKey(account.pubkey),
        owner,
        owner,
        [],
        account.programId === TOKEN_2022_PROGRAM_ID.toBase58()
          ? TOKEN_2022_PROGRAM_ID
          : undefined
      )
    );
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
