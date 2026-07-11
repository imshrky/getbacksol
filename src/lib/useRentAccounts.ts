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
  needsBurn?: boolean; // true for dust accounts — burn before close
  rawAmount?: string; // exact raw token amount to burn (only set when needsBurn is true)
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
 * Scans the connected wallet for SPL / Token-2022 accounts. Zero-balance
 * accounts (`accounts`) are closable directly; accounts with a small
 * leftover balance (`dustAccounts`) need a burn instruction first — see
 * reclaimRent.ts for how `needsBurn` / `rawAmount` get used when building
 * the transaction.
 */
export function useRentAccounts() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [accounts, setAccounts] = useState<RentAccount[]>([]);
  const [dustAccounts, setDustAccounts] = useState<RentAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setAccounts([]);
      setDustAccounts([]);
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
      const dust: RentAccount[] = [];

      for (const { value, programId } of [
        { value: legacy.value, programId: TOKEN_PROGRAM_ID },
        { value: token2022.value, programId: TOKEN_2022_PROGRAM_ID },
      ]) {
        for (const { pubkey, account } of value) {
          const info = account.data.parsed.info;
          const reclaimable = account.lamports / LAMPORTS_PER_SOL;
          if (info.tokenAmount.uiAmount === 0) {
            empty.push({
              pubkey: pubkey.toBase58(),
              mint: info.mint,
              programId: programId.toBase58(),
              reclaimable,
            });
          } else {
            dust.push({
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

      // Show the lists right away — symbol lookup is a decoration, not
      // something worth delaying "here's what we found" for.
      setAccounts(empty);
      setDustAccounts(dust);
      setLoading(false);

      const uniqueMints = [...new Set([...empty, ...dust].map((a) => a.mint))];
      if (uniqueMints.length > 0) {
        const entries = await Promise.all(
          uniqueMints.map(async (mint) => [mint, await resolveSymbol(mint)] as const)
        );
        const symbolByMint = new Map(entries);
        setAccounts((prev) => prev.map((a) => ({ ...a, symbol: symbolByMint.get(a.mint) ?? null })));
        setDustAccounts((prev) => prev.map((a) => ({ ...a, symbol: symbolByMint.get(a.mint) ?? null })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan wallet for token accounts.");
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, dustAccounts, dustCount: dustAccounts.length, loading, error, refresh };
}
