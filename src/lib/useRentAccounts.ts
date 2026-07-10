"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type RentAccount = {
  pubkey: string;
  mint: string;
  programId: string;
  reclaimable: number; // actual lamports held by the account, in SOL
};

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Scans the connected wallet for SPL / Token-2022 accounts sitting at a
 * zero balance — these are the ones eligible to close and reclaim rent
 * from. Accounts with a nonzero (dust) balance are counted but excluded
 * until Safe-Burn support ships.
 */
export function useRentAccounts() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [accounts, setAccounts] = useState<RentAccount[]>([]);
  const [dustCount, setDustCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setAccounts([]);
      setDustCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [legacy, token2022] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
      ]);

      const empty: RentAccount[] = [];
      let dust = 0;

      for (const { value, programId } of [
        { value: legacy.value, programId: TOKEN_PROGRAM_ID },
        { value: token2022.value, programId: TOKEN_2022_PROGRAM_ID },
      ]) {
        for (const { pubkey, account } of value) {
          const info = account.data.parsed.info;
          if (info.tokenAmount.uiAmount === 0) {
            empty.push({
              pubkey: pubkey.toBase58(),
              mint: info.mint,
              programId: programId.toBase58(),
              reclaimable: account.lamports / LAMPORTS_PER_SOL,
            });
          } else {
            dust += 1;
          }
        }
      }

      setAccounts(empty);
      setDustCount(dust);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan wallet for token accounts.");
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, dustCount, loading, error, refresh };
}
