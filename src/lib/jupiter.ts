import "server-only";
import { PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createCloseAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const JUPITER_BUILD_URL = "https://api.jup.ag/swap/v2/build";

// Below this, selling isn't worth an extra relayed transaction over a
// plain, instant burn — dust this small nets almost nothing either way.
const MIN_SELL_OUTPUT_LAMPORTS = 2_000_000n; // ~0.002 SOL

type JupiterInstruction = {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
};

function toTransactionInstruction(ix: JupiterInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

export type SellRoute = { instructions: TransactionInstruction[]; guaranteedLamports: bigint };

/**
 * Fetches instructions to swap a dust SPL token into native SOL via
 * Jupiter's Router API, for appending to our own transaction — our own fee
 * payer, our own closeAccount + fee transfer, never Jupiter's own
 * submission path (we need our fee payer to co-sign, not Jupiter's infra).
 *
 * Jupiter always creates the owner's wrapped-SOL account (if it doesn't
 * already exist) with our fee payer as `payer`, so the owner never needs
 * SOL upfront — but Jupiter's own cleanup step always returns that
 * account's full balance (rent + proceeds, indistinguishable for wrapped
 * SOL) to the owner, not whoever paid to create it. Left as-is, that would
 * mean the fee payer permanently loses ~0.002 SOL of real rent on every
 * sale that needs a new account. So when a new account is required, we
 * skip Jupiter's cleanup instruction and substitute our own: close it to
 * the fee payer (recovering the fronted rent plus the full proceeds), then
 * pay the owner the quote's guaranteed minimum (`otherAmountThreshold`)
 * directly. Any amount received above that minimum — positive slippage —
 * covers the rent that was fronted instead of coming out of the fee
 * payer; the owner is never shorted, since the swap itself reverts
 * on-chain if it can't deliver at least that minimum.
 */
export async function getSellRoute(
  mint: string,
  rawAmount: string,
  owner: PublicKey,
  feePayer: PublicKey
): Promise<SellRoute | null> {
  const params = new URLSearchParams({
    inputMint: mint,
    outputMint: WSOL_MINT.toBase58(),
    amount: rawAmount,
    taker: owner.toBase58(),
    payer: feePayer.toBase58(),
    slippageBps: "500",
  });

  let res: Response;
  try {
    res = await fetch(`${JUPITER_BUILD_URL}?${params.toString()}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data?.swapInstruction) return null;

  const outAmount = BigInt(data.outAmount ?? "0");
  if (outAmount < MIN_SELL_OUTPUT_LAMPORTS) return null;

  const needsNewAccount = (data.setupInstructions ?? []).length > 0;
  const guaranteedLamports = needsNewAccount ? BigInt(data.otherAmountThreshold ?? "0") : outAmount;
  if (guaranteedLamports <= 0n) return null;

  const instructions: TransactionInstruction[] = [
    ...(data.computeBudgetInstructions ?? []).map(toTransactionInstruction),
    ...(data.setupInstructions ?? []).map(toTransactionInstruction),
    toTransactionInstruction(data.swapInstruction),
  ];

  if (needsNewAccount) {
    const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, owner);
    instructions.push(createCloseAccountInstruction(wsolAta, feePayer, owner, [], TOKEN_PROGRAM_ID));
    instructions.push(
      SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: owner, lamports: guaranteedLamports })
    );
  } else if (data.cleanupInstruction) {
    instructions.push(toTransactionInstruction(data.cleanupInstruction));
  }

  return { instructions, guaranteedLamports };
}
