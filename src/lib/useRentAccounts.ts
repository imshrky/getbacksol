"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type RentAccount = {
  pubkey: string;
  mint: string;
  programId: string;
  reclaimable: number; // actual lamports held by the account, in SOL
  symbol?: string | null; // resolved lazily via /api/token-meta; undefined until resolved
};

const LAMPORTS_PER_SOL = 1_000_000_000;

// Module-level so the cache survives across re-scans within the same tab.
const symbolCache = new Map<string, string | null>();

async function resolveSymbol(mint: string): Promise<string | null> {
  if (symbolCache.has(mint)) return symbolCache.get(mint)!;
  try {
    const res = await fetch(`/api/token-meta?address=${encodeURIComponent(mint)}`);
    const json = await res.json();
    const symbol: string | null = json?.symbol ?? null;
    symbolCache.set(mint, symbol);
    return symbol;
  } catch {
    symbolCache.set(mint, null);
    return null;
  }
}

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

      // Show the list right away — symbol lookup is a decoration, not
      // something worth delaying "here's what we found" for.
      setAccounts(empty);
      setDustCount(dust);
      setLoading(false);

      const uniqueMints = [...new Set(empty.map((a) => a.mint))];
      if (uniqueMints.length > 0) {
        const entries = await Promise.all(
          uniqueMints.map(async (mint) => [mint, await resolveSymbol(mint)] as const)
        );
        const symbolByMint = new Map(entries);
        setAccounts((prev) => prev.map((a) => ({ ...a, symbol: symbolByMint.get(a.mint) ?? null })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan wallet for token accounts.");
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, dustCount, loading, error, refresh };
}
