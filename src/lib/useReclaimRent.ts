"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { TxStatus } from "./useSimulatedTx";
import { buildCloseAccountBatchTx, chunk, MAX_ACCOUNTS_PER_TX } from "./reclaimRent";
import { RECLAIM_FEE_RATE } from "./mockTokens";
import type { RentAccount } from "./useRentAccounts";

const FEE_PAYER_ADDRESS = process.env.NEXT_PUBLIC_FEE_PAYER_ADDRESS;

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
    async (accounts: RentAccount[]) => {
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
      const batches = chunk(accounts, MAX_ACCOUNTS_PER_TX);
      let closedCount = 0;

      try {
        for (const batch of batches) {
          const tx = buildCloseAccountBatchTx(publicKey, feePayer, batch);
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;

          const signed = await signTransaction(tx);
          const serialized = signed.serialize({ requireAllSignatures: false });

          const res = await fetch("/api/relay-close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transaction: serialized.toString("base64") }),
          });

          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body?.error || "The relay failed to submit this transaction.");
          }

          closedCount += batch.length;
        }

        const gross = accounts.reduce((sum, a) => sum + a.reclaimable, 0);
        const net = gross * (1 - RECLAIM_FEE_RATE);
        setStatus("success");
        setMessage(
          `Closed ${closedCount} account${closedCount > 1 ? "s" : ""} — ~${net.toFixed(6)} SOL sent to your wallet.`
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Transaction failed.";
        if (closedCount > 0) {
          setStatus("success");
          setMessage(
            `Closed ${closedCount} of ${accounts.length} accounts before an error occurred: ${errMsg}`
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
