"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { TxStatus } from "./useSimulatedTx";
import { buildCloseAccountBatchTx, chunk, MAX_ACCOUNTS_PER_TX } from "./reclaimRent";
import { RECLAIM_FEE_RATE } from "./mockTokens";
import type { RentAccount } from "./useRentAccounts";

/**
 * Real on-chain counterpart to useSimulatedTx for Reclaim Rent: builds,
 * signs (via the connected wallet) and sends closeAccount + fee-transfer
 * transactions, batching accounts to stay under the transaction size limit.
 */
export function useReclaimRent() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState("");

  const run = useCallback(
    async (accounts: RentAccount[]) => {
      if (!connected || !publicKey) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to continue.");
        return;
      }
      if (accounts.length === 0) return;

      setStatus("pending");
      setMessage("");

      const batches = chunk(accounts, MAX_ACCOUNTS_PER_TX);
      let closedCount = 0;

      try {
        for (const batch of batches) {
          const tx = buildCloseAccountBatchTx(publicKey, batch);
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;

          const signature = await sendTransaction(tx, connection);
          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
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
    [connected, publicKey, connection, sendTransaction]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  return { status, message, run, reset };
}
