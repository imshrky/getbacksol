"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import type { TxStatus } from "./useSimulatedTx";
import { buildCloseAccountBatchTx, batchByInstructionBudget } from "./reclaimRent";
import { RECLAIM_FEE_RATE } from "./mockTokens";
import type { RentAccount } from "./useRentAccounts";
import { getReferral } from "./referral";

const FEE_PAYER_ADDRESS = process.env.NEXT_PUBLIC_FEE_PAYER_ADDRESS;
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Real on-chain counterpart to useSimulatedTx for Reclaim Rent — gasless:
 * the owner signs to authorize closing their own accounts, but the
 * platform's fee-payer wallet covers the network fee and submits the
 * transaction via /api/relay-close, so the owner never needs to hold SOL.
 */
export function useReclaimRent() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState("");

  const run = useCallback(
    async (accounts: RentAccount[], options?: { sellDust?: boolean }) => {
      if (!connected || !publicKey) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to continue.");
        return;
      }
      if (!signTransaction) {
        setStatus("error");
        setMessage("This wallet doesn't support the signing method Reclaim Rent needs.");
        return;
      }
      if (!FEE_PAYER_ADDRESS) {
        setStatus("error");
        setMessage("Gasless relay is not configured yet.");
        return;
      }
      if (accounts.length === 0) return;

      setStatus("pending");
      setMessage("");

      const feePayer = new PublicKey(FEE_PAYER_ADDRESS);
      const partnerId = getReferral();
      let closedCount = 0;
      let soldCount = 0;
      let soldLamports = 0;

      async function relay(serializedTx: Buffer) {
        const res = await fetch("/api/relay-close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: serializedTx.toString("base64"),
            ...(partnerId ? { partnerId } : {}),
          }),
        });
        const resBody = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(resBody?.error || "The relay failed to submit this transaction.");
      }

      // Tries to sell one dust account for SOL via Jupiter instead of
      // burning it. Returns false (never throws) whenever selling isn't
      // viable — the caller falls back to including the account in the
      // normal burn/close batch.
      async function trySell(account: RentAccount): Promise<boolean> {
        try {
          const buildRes = await fetch("/api/build-sell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              owner: publicKey!.toBase58(),
              tokenAccount: account.pubkey,
              mint: account.mint,
              rawAmount: account.rawAmount,
              programId: account.programId,
            }),
          });
          if (!buildRes.ok) return false;
          const { transaction, outAmount } = await buildRes.json();

          const tx = Transaction.from(Buffer.from(transaction, "base64"));
          const signed = await signTransaction!(tx);
          await relay(signed.serialize({ requireAllSignatures: false }));

          soldLamports += Number(outAmount);
          return true;
        } catch {
          return false;
        }
      }

      const toBurnOrClose: RentAccount[] = [];

      try {
        if (options?.sellDust) {
          for (const account of accounts) {
            if (!account.needsBurn) {
              toBurnOrClose.push(account);
              continue;
            }
            const sold = await trySell(account);
            if (sold) soldCount++;
            else toBurnOrClose.push(account);
          }
        } else {
          toBurnOrClose.push(...accounts);
        }

        const batches = batchByInstructionBudget(toBurnOrClose);
        for (const batch of batches) {
          const tx = buildCloseAccountBatchTx(publicKey, feePayer, batch);
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;

          const signed = await signTransaction(tx);
          await relay(signed.serialize({ requireAllSignatures: false }));

          closedCount += batch.length;
        }

        const gross = toBurnOrClose.reduce((sum, a) => sum + a.reclaimable, 0);
        const net = gross * (1 - RECLAIM_FEE_RATE) + soldLamports / LAMPORTS_PER_SOL;
        setStatus("success");
        const parts = [
          closedCount > 0 ? `Closed ${closedCount} account${closedCount > 1 ? "s" : ""}` : null,
          soldCount > 0 ? `sold dust from ${soldCount} account${soldCount > 1 ? "s" : ""}` : null,
        ].filter(Boolean);
        setMessage(`${parts.join(" and ")} — ~${net.toFixed(6)} SOL sent to your wallet.`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Transaction failed.";
        if (closedCount > 0 || soldCount > 0) {
          setStatus("success");
          setMessage(
            `Handled ${closedCount + soldCount} of ${accounts.length} accounts before an error occurred: ${errMsg}`
          );
        } else {
          setStatus("error");
          setMessage(errMsg);
        }
      }
    },
    [connected, publicKey, connection, signTransaction]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  return { status, message, run, reset };
}
