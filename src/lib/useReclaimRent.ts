"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import type { TxStatus } from "./useSimulatedTx";
import { buildCloseAccountBatchTx, batchByInstructionBudget, calculateReclaimSummary } from "./reclaimRent";
import type { RentAccount } from "./useRentAccounts";
import { getReferral } from "./referral";
import { trackEvent } from "./analytics";

const FEE_PAYER_ADDRESS = process.env.NEXT_PUBLIC_FEE_PAYER_ADDRESS;
const LAMPORTS_PER_SOL = 1_000_000_000;
// One signature's base fee (5,000 lamports) plus margin for a
// wallet-added priority fee — the bar for letting the owner pay their own
// network fee instead of having the relay pay it for them.
const LAMPORTS_PER_TX_WITH_MARGIN = 10_000;
// Closing the wallet extension's own approval popup (its window X, not a
// Cancel button inside it) doesn't reliably reject signTransaction() —
// some wallets only reject on an explicit in-app dismissal, so the
// promise can otherwise hang forever with no signal reaching the page at
// all. A website can't observe a browser extension's popup lifecycle
// directly, so a timeout is the only generic way to recover here.
const SIGN_TIMEOUT_MS = 60_000;

// The wallet adapter passes the extension's own rejection message straight
// through (e.g. Phantom's "User rejected the request."). Closing the
// popup or clicking Cancel is a deliberate choice, not a failure — showing
// a red error banner for something the user did on purpose is just
// friction, so this is treated as a silent, no-message reset instead.
function isUserRejection(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /reject|declin|cancel|user closed|dismiss/i.test(msg);
}

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

  // Wallet extensions don't reject a pending signTransaction() call just
  // because the user switches apps (e.g. to grab a password from their
  // keychain) — the promise just sits there until they come back and
  // explicitly approve or dismiss it in the extension itself. Without
  // this, "pending" could get stuck forever from the page's point of
  // view. Each run() bumps this token; anything that resolves after the
  // token has moved on (a manual reset, or a fresh run) is stale and its
  // result is discarded instead of clobbering whatever the UI moved to.
  const runToken = useRef(0);

  const reset = useCallback(() => {
    runToken.current++;
    setStatus("idle");
    setMessage("");
  }, []);

  // If the tab regains focus while still "pending", the user almost
  // certainly tabbed away mid-approval (password manager, another app)
  // rather than the wallet actually taking that long. Free the UI to try
  // again rather than leaving the button stuck on "Closing accounts…".
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && status === "pending") {
        runToken.current++;
        setStatus("idle");
        setMessage(
          "Still waiting on wallet approval when you switched away — cancelled. Ready to try again."
        );
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

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

      const myToken = ++runToken.current;
      const isStale = () => runToken.current !== myToken;

      setStatus("pending");
      setMessage("");

      const partnerId = getReferral();
      let closedCount = 0;
      let soldCount = 0;
      let soldLamports = 0;

      // Some wallets return a signature that looks valid but doesn't
      // actually verify against the message we asked them to sign (see
      // CLAUDE.md — found via Trust Wallet, though the root cause turned
      // out not to be specific to the fee-payer pattern, since it kept
      // happening after that was changed; Trust Wallet was removed from
      // SUPPORTED_WALLETS in page.tsx as a result). Kept as a general
      // safeguard for any wallet that might hit this — `.serialize()`
      // would eventually throw the same thing anyway, but catching it here
      // gives a clearer, earlier message. `false` means "only check
      // signatures that are present": the fee payer's slot may still be
      // empty at this point on the legacy (Sell flow) code path, that's
      // expected and not itself an error.
      async function signWithTimeout(tx: Transaction): Promise<Transaction> {
        const signed = await Promise.race([
          signTransaction!(tx),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Wallet approval timed out — the request may have been closed.")),
              SIGN_TIMEOUT_MS
            )
          ),
        ]);
        if (!signed.verifySignatures(false)) {
          throw new Error(
            "Your wallet returned a signature that doesn't verify. This is a known compatibility issue with a small number of wallets — please try Phantom, Solflare, or Backpack instead."
          );
        }
        return signed;
      }

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
          const signed = await signWithTimeout(tx);
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

        // Who pays the network fee. The owner paying it themselves is the
        // most widely compatible shape, so that stays the default whenever
        // they can actually afford it. A wallet holding (almost) nothing
        // can't — and can't be topped up either, since Solana rejects any
        // transaction that leaves a wallet holding less than the
        // rent-exempt minimum, which a small top-up always did. For those,
        // the relay pays and co-signs instead (see /api/relay-close).
        const ownerBalance = await connection.getBalance(publicKey);
        const ownerCanPayFees = ownerBalance >= batches.length * LAMPORTS_PER_TX_WITH_MARGIN;
        const batchFeePayer = ownerCanPayFees ? publicKey : new PublicKey(FEE_PAYER_ADDRESS);

        for (const batch of batches) {
          const tx = buildCloseAccountBatchTx(publicKey, batch, batchFeePayer);
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;

          const signed = await signWithTimeout(tx);
          await relay(signed.serialize({ requireAllSignatures: false }));

          closedCount += batch.length;
        }

        if (isStale()) return;

        const net = calculateReclaimSummary(toBurnOrClose).net + soldLamports / LAMPORTS_PER_SOL;
        trackEvent("reclaim_completed", {
          wallet: publicKey.toBase58(),
          accountsClosed: closedCount,
          accountsSold: soldCount,
          netSol: net,
        });
        setStatus("success");
        const parts = [
          closedCount > 0 ? `Closed ${closedCount} account${closedCount > 1 ? "s" : ""}` : null,
          soldCount > 0 ? `sold dust from ${soldCount} account${soldCount > 1 ? "s" : ""}` : null,
        ].filter(Boolean);
        setMessage(`${parts.join(" and ")} — ~${net.toFixed(6)} SOL sent to your wallet.`);
      } catch (e) {
        if (isStale()) return;

        if (closedCount > 0 || soldCount > 0) {
          const errMsg = e instanceof Error ? e.message : "Transaction failed.";
          setStatus("success");
          setMessage(
            `Handled ${closedCount + soldCount} of ${accounts.length} accounts before an error occurred: ${errMsg}`
          );
        } else if (isUserRejection(e)) {
          setStatus("idle");
          setMessage("");
        } else {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "Transaction failed.");
        }
      }
    },
    [connected, publicKey, connection, signTransaction]
  );

  return { status, message, run, reset };
}
