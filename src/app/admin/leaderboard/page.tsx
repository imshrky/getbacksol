"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import { ShieldAlert } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import type { TxStatus } from "@/lib/useSimulatedTx";
import { FEE_WALLET } from "@/lib/feeWallet";

const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const LAMPORTS_PER_SOL = 1_000_000_000;

type PendingPayout = {
  weekStart: string;
  poolLamports: string;
  winners: { rank: number; wallet: string; xp: number; amountLamports: string }[];
};

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Operational tool, not a public feature: shows the previous week's pending
 * leaderboard prize payout and lets whoever holds the FEE_WALLET key sign
 * and send it themselves. The app never holds that private key (see
 * feeWallet.ts) — this page only builds the transaction and, after it
 * confirms on-chain, asks the server to verify and record it (see
 * /api/leaderboard/payout).
 */
export default function AdminLeaderboardPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [pending, setPending] = useState<PendingPayout | null | undefined>(undefined);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState("");

  const loadPending = useCallback(() => {
    fetch("/api/leaderboard/payout")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPending(data?.pending ?? null))
      .catch(() => setPending(null));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const isFeeWallet = connected && publicKey && publicKey.equals(FEE_WALLET);

  async function payWinners() {
    if (!pending || !publicKey || !isFeeWallet) return;
    setStatus("pending");
    setMessage("");
    try {
      const tx = new Transaction();
      for (const winner of pending.winners) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(winner.wallet),
            lamports: BigInt(winner.amountLamports),
          })
        );
      }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      const res = await fetch("/api/leaderboard/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server could not verify the payout.");

      setStatus("success");
      setMessage(`Paid ${pending.winners.length} winners for the week of ${pending.weekStart}.`);
      loadPending();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payout failed.";
      if (/reject|declin|cancel/i.test(msg)) {
        setStatus("idle");
        setMessage("");
      } else {
        setStatus("error");
        setMessage(msg);
      }
    }
  }

  return (
    <div className="fade-in">
      <SectionTitle
        align="left"
        eyebrow="Admin"
        title="Weekly leaderboard payout"
        description="Connect the fee wallet to review and pay last week's top 3."
      />

      <Card className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">
            Fee wallet: <span className="font-mono">{shortenAddress(FEE_WALLET.toBase58())}</span>
          </span>
          <WalletMultiButtonDynamic />
        </div>

        {connected && !isFeeWallet && (
          <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Connect the fee wallet above ({shortenAddress(FEE_WALLET.toBase58())}) to pay winners.
          </div>
        )}

        {pending === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : pending === null ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing pending — last week is already paid, or had no activity.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm">
              Week of <span className="font-medium">{pending.weekStart}</span> — pool:{" "}
              <span className="font-semibold text-[var(--accent)]">
                {(Number(pending.poolLamports) / LAMPORTS_PER_SOL).toFixed(4)} SOL
              </span>
            </p>
            <ul className="mb-4 flex flex-col gap-2">
              {pending.winners.map((w) => (
                <li
                  key={w.wallet}
                  className="flex items-center justify-between rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">
                    #{w.rank} {shortenAddress(w.wallet)}
                  </span>
                  <span className="text-[var(--accent)]">
                    {(Number(w.amountLamports) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="btn-primary w-full"
              disabled={!isFeeWallet || status === "pending"}
              onClick={payWinners}
            >
              {status === "pending" ? "Paying…" : "Pay winners"}
            </button>
          </>
        )}

        <TxStatusBanner status={status} message={message} pendingText="Sending payout transaction…" />
      </Card>
    </div>
  );
}
