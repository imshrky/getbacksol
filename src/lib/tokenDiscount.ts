"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { RECLAIM_FEE_RATE } from "./mockTokens";

// $GBS holder discount. All config-driven and fully dormant until the token
// launches: with no NEXT_PUBLIC_GBS_TOKEN_MINT set, every function here returns
// the standard fee rate, so behaviour is identical to today.
const MINT = process.env.NEXT_PUBLIC_GBS_TOKEN_MINT;
const HOLDER_MIN_BALANCE = Number(process.env.NEXT_PUBLIC_GBS_HOLDER_MIN_BALANCE ?? "0");
// Default discount: half the standard fee (e.g. 30% -> 15%). Override with
// NEXT_PUBLIC_GBS_HOLDER_FEE_RATE once the tokenomics numbers are final.
const HOLDER_FEE_RATE = process.env.NEXT_PUBLIC_GBS_HOLDER_FEE_RATE
  ? Number(process.env.NEXT_PUBLIC_GBS_HOLDER_FEE_RATE)
  : RECLAIM_FEE_RATE / 2;

export const HOLDER_DISCOUNT_ENABLED = !!MINT;

/**
 * The fee rate that applies to `owner`: the discounted rate if they hold at
 * least HOLDER_MIN_BALANCE $GBS, otherwise the standard rate. Never throws and
 * never blocks a reclaim — any balance-check hiccup falls back to the standard
 * rate. Returns the standard rate immediately when no token mint is configured.
 */
export async function getHolderFeeRate(connection: Connection, owner: PublicKey | null): Promise<number> {
  if (!MINT || !owner) return RECLAIM_FEE_RATE;
  try {
    const res = await connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(MINT) });
    const balance = res.value.reduce(
      (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
      0
    );
    return balance >= HOLDER_MIN_BALANCE ? HOLDER_FEE_RATE : RECLAIM_FEE_RATE;
  } catch {
    return RECLAIM_FEE_RATE;
  }
}

/**
 * Reactive version for the fee preview in the UI: resolves the connected
 * wallet's applicable rate. Starts at the standard rate and lowers it once the
 * on-chain balance check resolves for a holder.
 */
export function useHolderFeeRate(): number {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [rate, setRate] = useState(RECLAIM_FEE_RATE);

  useEffect(() => {
    let cancelled = false;
    if (!MINT || !publicKey) {
      setRate(RECLAIM_FEE_RATE);
      return;
    }
    getHolderFeeRate(connection, publicKey).then((r) => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey]);

  return rate;
}
