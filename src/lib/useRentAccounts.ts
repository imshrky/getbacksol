"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { scanWalletForRentAccounts, type RentAccount } from "./scanWallet";

export type { RentAccount };

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
 * the transaction. The actual scan logic lives in scanWallet.ts so it can
 * be reused server-side (the partner API's scan endpoint).
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
      const { accounts: empty, dustAccounts: dust } = await scanWalletForRentAccounts(
        connection,
        publicKey
      );

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
