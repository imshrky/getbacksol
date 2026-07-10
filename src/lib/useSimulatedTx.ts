"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export type TxStatus = "idle" | "needs-wallet" | "pending" | "success" | "error";

/**
 * Mock transaction runner used across the mockup pages.
 * Replace the setTimeout body with a real @solana/web3.js call
 * once the on-chain program / instructions described in
 * docs/backend-architecture.md are implemented.
 */
export function useSimulatedTx() {
  const { connected } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const run = useCallback(
    async (successMessage: string, delayMs = 1400) => {
      if (!connected) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to continue.");
        return;
      }
      setStatus("pending");
      setMessage("");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      setStatus("success");
      setMessage(successMessage);
    },
    [connected]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
  }, []);

  return { status, message, run, reset, connected };
}
