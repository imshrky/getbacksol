"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type PortfolioHolding = {
  mint: string;
  uiAmount: number;
  symbol?: string | null;
  usdValue?: number | null;
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;
const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";
const MAX_PRICE_IDS_PER_REQUEST = 50;

// Shared with useRentAccounts' own cache conceptually, but kept separate to
// avoid a cross-module coupling — both just call the same free endpoint.
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

async function fetchPrices(mints: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  for (let i = 0; i < mints.length; i += MAX_PRICE_IDS_PER_REQUEST) {
    const batch = mints.slice(i, i + MAX_PRICE_IDS_PER_REQUEST);
    try {
      const res = await fetch(`${JUPITER_PRICE_URL}?ids=${batch.map(encodeURIComponent).join(",")}`);
      if (!res.ok) continue;
      const json = await res.json();
      for (const mint of batch) {
        const usdPrice = json?.[mint]?.usdPrice;
        if (typeof usdPrice === "number") prices[mint] = usdPrice;
      }
    } catch {
      // Missing prices just mean that token's USD value stays unknown — not fatal.
    }
  }
  return prices;
}

/**
 * Full wallet snapshot — every token held (not just the zero-balance ones
 * Reclaim Rent can close), with resolved symbols and live USD pricing via
 * Jupiter's free, keyless Price API.
 */
export function usePortfolio() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [solBalance, setSolBalance] = useState(0);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setHoldings([]);
      setSolBalance(0);
      setSolPrice(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [lamports, legacy, token2022] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
      ]);
      setSolBalance(lamports / LAMPORTS_PER_SOL);

      const byMint = new Map<string, number>();
      for (const { value } of [legacy, token2022]) {
        for (const { account } of value) {
          const info = account.data.parsed.info;
          const amount: number = info.tokenAmount.uiAmount ?? 0;
          if (amount > 0) {
            byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + amount);
          }
        }
      }

      const initialHoldings: PortfolioHolding[] = [...byMint.entries()].map(([mint, uiAmount]) => ({
        mint,
        uiAmount,
      }));
      setHoldings(initialHoldings);
      setLoading(false);

      const mints = initialHoldings.map((h) => h.mint);
      const [symbolEntries, prices] = await Promise.all([
        Promise.all(mints.map(async (mint) => [mint, await resolveSymbol(mint)] as const)),
        fetchPrices([...mints, SOL_MINT]),
      ]);

      const symbolByMint = new Map(symbolEntries);
      setHoldings(
        initialHoldings.map((h) => ({
          ...h,
          symbol: symbolByMint.get(h.mint) ?? null,
          usdValue: prices[h.mint] != null ? prices[h.mint] * h.uiAmount : null,
        }))
      );
      setSolPrice(prices[SOL_MINT] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio.");
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const solUsdValue = solPrice != null ? solPrice * solBalance : null;
  const tokensUsdValue = holdings.reduce((sum, h) => sum + (h.usdValue ?? 0), 0);
  const totalUsdValue = solUsdValue != null ? solUsdValue + tokensUsdValue : tokensUsdValue || null;

  return { holdings, solBalance, solPrice, totalUsdValue, loading, error, refresh };
}
