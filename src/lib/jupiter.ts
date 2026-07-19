import "server-only";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
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

export type SellRoute = {
  instructions: TransactionInstruction[];
  needsNewAccount: boolean;
  minOut: bigint;
};

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
 * the fee payer (recovering the fronted rent plus the full proceeds).
 * build-sell then pays the owner their net and routes the platform fee —
 * the payout/fee split lives there so all the money logic is in one place.
 *
 * `minOut` (the swap's `otherAmountThreshold`) is the on-chain guaranteed
 * minimum: the swap reverts if it delivers less, so build-sell uses it as
 * the safe base for the proceeds fee. Returned for both cases so the fee is
 * computed the same way whether or not a new account was needed.
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

  // Guaranteed minimum the swap must deliver or it reverts on-chain — the
  // safe base for build-sell's proceeds fee (never charge on the optimistic
  // quote, which slippage might not deliver).
  const minOut = BigInt(data.otherAmountThreshold ?? "0");
  if (minOut <= 0n) return null;

  const needsNewAccount = (data.setupInstructions ?? []).length > 0;

  const instructions: TransactionInstruction[] = [
    ...(data.computeBudgetInstructions ?? []).map(toTransactionInstruction),
    ...(data.setupInstructions ?? []).map(toTransactionInstruction),
    toTransactionInstruction(data.swapInstruction),
  ];

  if (needsNewAccount) {
    // New wrapped-SOL account: the fee payer fronted its rent, so close it
    // to the fee payer (recovering that rent + the full proceeds). build-sell
    // pays the owner their net and splits out the fee.
    const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, owner);
    instructions.push(createCloseAccountInstruction(wsolAta, feePayer, owner, [], TOKEN_PROGRAM_ID));
  } else if (data.cleanupInstruction) {
    // Existing wrapped-SOL account: Jupiter's own cleanup unwraps the
    // proceeds back to the owner as native SOL, which build-sell then takes
    // its fee from.
    instructions.push(toTransactionInstruction(data.cleanupInstruction));
  }

  return { instructions, needsNewAccount, minOut };
}
