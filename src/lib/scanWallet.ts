import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type RentAccount = {
  pubkey: string;
  mint: string;
  programId: string;
  reclaimable: number; // actual lamports held by the account, in SOL
  symbol?: string | null; // resolved lazily via /api/token-meta; undefined until resolved
  needsBurn?: boolean; // true for dust accounts — burn before close
  rawAmount?: string; // exact raw token amount to burn (only set when needsBurn is true)
};

/**
 * Core wallet scan: every SPL / Token-2022 account split into zero-balance
 * (`accounts`, directly closable) and residual-balance (`dustAccounts`,
 * need a burn first). Plain function with no React/browser dependency, so
 * it works from both the client hook (useRentAccounts.ts) and server-side
 * API routes (the partner scan endpoint) without duplicating this logic.
 */
export async function scanWalletForRentAccounts(
  connection: Connection,
  owner: PublicKey
): Promise<{ accounts: RentAccount[]; dustAccounts: RentAccount[] }> {
  const [legacy, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  const accounts: RentAccount[] = [];
  const dustAccounts: RentAccount[] = [];

  for (const { value, programId } of [
    { value: legacy.value, programId: TOKEN_PROGRAM_ID },
    { value: token2022.value, programId: TOKEN_2022_PROGRAM_ID },
  ]) {
    for (const { pubkey, account } of value) {
      const info = account.data.parsed.info;
      const reclaimable = account.lamports / LAMPORTS_PER_SOL;
      if (info.tokenAmount.uiAmount === 0) {
        accounts.push({
          pubkey: pubkey.toBase58(),
          mint: info.mint,
          programId: programId.toBase58(),
          reclaimable,
        });
      } else {
        dustAccounts.push({
          pubkey: pubkey.toBase58(),
          mint: info.mint,
          programId: programId.toBase58(),
          reclaimable,
          needsBurn: true,
          rawAmount: info.tokenAmount.amount,
        });
      }
    }
  }

  return { accounts, dustAccounts };
}
