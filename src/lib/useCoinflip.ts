"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { FEE_WALLET } from "./feeWallet";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type CoinflipSide = "heads" | "tails";
export type CoinflipStatus = "idle" | "pending" | "resolved" | "error" | "needs-wallet";

export type CoinflipResult = {
  outcome: "win" | "loss";
  wagerLamports: number;
  payoutLamports: number;
  payoutSignature: string | null;
  serverSeed: string;
  commitHash: string;
};

function randomClientSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Real-money coin flip: the player sends their wager directly to FEE_WALLET
 * (no relay — same "pay your own network fee" pattern as Token Creator),
 * then the server resolves the round and, on a win, pays out double
 * automatically from FEE_WALLET. See src/lib/coinflip.ts for the
 * commit-reveal fairness scheme and src/app/api/coinflip/* for the two
 * round-trip steps this orchestrates.
 */
export function useCoinflip() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<CoinflipStatus>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CoinflipResult | null>(null);

  const run = useCallback(
    async (side: CoinflipSide, wagerSol: number) => {
      if (!connected || !publicKey) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to play.");
        return;
      }
      if (!signTransaction) {
        setStatus("error");
        setMessage("This wallet doesn't support the signing method needed.");
        return;
      }

      setStatus("pending");
      setMessage("");
      setResult(null);

      try {
        const commitRes = await fetch("/api/coinflip/commit", { method: "POST" });
        const commitBody = await commitRes.json().catch(() => ({}));
        if (!commitRes.ok) throw new Error(commitBody?.error || "Couldn't start a round.");
        const { roundId } = commitBody;

        const wagerLamports = Math.round(wagerSol * LAMPORTS_PER_SOL);
        const tx = new Transaction();
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: FEE_WALLET, lamports: wagerLamports }));
        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const signed = await signTransaction(tx);
        const betTxSignature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction({ signature: betTxSignature, blockhash, lastValidBlockHeight }, "confirmed");

        const resolveRes = await fetch("/api/coinflip/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId, betTxSignature, side, clientSeed: randomClientSeed() }),
        });
        const resolveBody = await resolveRes.json().catch(() => ({}));
        if (!resolveRes.ok) throw new Error(resolveBody?.error || "Couldn't resolve the round.");

        setStatus("resolved");
        setResult(resolveBody);
        setMessage(
          resolveBody.outcome === "win"
            ? `You doubled it! +${(resolveBody.payoutLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`
            : "Zeroed. Better luck next flip."
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Flip failed.";
        if (/reject|declin|cancel/i.test(msg)) {
          setStatus("idle");
          setMessage("");
        } else {
          setStatus("error");
          setMessage(msg);
        }
      }
    },
    [connected, publicKey, signTransaction, connection]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setResult(null);
  }, []);

  return { status, message, result, run, reset };
}
