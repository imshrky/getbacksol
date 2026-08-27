"use client";

// TEMPORARY SCAFFOLDING — delete this file (and its two usages in
// src/app/coinflip/page.tsx) once the game's feel has been signed off and
// real-money play goes live.
//
// Deliberately self-contained and entirely client-side: no wallet, no API
// call, no database write. That isn't laziness — a server-side "resolve
// without verifying payment" path is exactly the kind of thing that becomes
// a real vulnerability if it ever outlives its purpose or ships enabled by
// mistake. Nothing here can pay anyone, because nothing here can reach the
// server at all.

import { useCallback, useState } from "react";
import { COINFLIP_WIN_PROBABILITY } from "./coinflipConfig";
import type { CoinflipSide, CoinflipStatus } from "./useCoinflip";

const LAMPORTS_PER_SOL = 1_000_000_000;
const STARTING_BALANCE_SOL = 1;
// Roughly what a real round costs in wall-clock time (wallet approval plus
// on-chain confirmation), so the pacing being judged here matches the
// pacing of the real thing rather than feeling deceptively instant.
const SIMULATED_ROUND_MS = 1400;

export type DemoFlip = {
  side: CoinflipSide;
  wagerSol: number;
  outcome: "win" | "loss";
  at: number;
};

export type DemoResult = {
  outcome: "win" | "loss";
  wagerLamports: number;
  payoutLamports: number;
  payoutSignature: null;
  serverSeed: string;
  commitHash: string;
};

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Mirrors useCoinflip's shape so the page can swap between them without
 * branching all over its JSX. Uses the same win probability as the real
 * game, and produces a genuine commit-reveal pair (the revealed seed really
 * does hash to the shown commitment), so the fairness panel being reviewed
 * here behaves exactly like the live one.
 */
export function useCoinflipDemo() {
  const [status, setStatus] = useState<CoinflipStatus>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [balanceSol, setBalanceSol] = useState(STARTING_BALANCE_SOL);
  const [flips, setFlips] = useState<DemoFlip[]>([]);

  const run = useCallback(
    async (side: CoinflipSide, wagerSol: number) => {
      if (wagerSol > balanceSol) {
        setStatus("error");
        setMessage("Not enough demo SOL for that wager. Reset the demo balance to keep going.");
        return;
      }

      setStatus("pending");
      setMessage("");
      setResult(null);
      setBalanceSol((b) => b - wagerSol);

      const serverSeed = randomHex(32);
      const commitHash = await sha256Hex(serverSeed);
      await new Promise((r) => setTimeout(r, SIMULATED_ROUND_MS));

      // Same odds as the real game (see coinflipConfig.ts) — the point of
      // this mode is to preview the real experience, not a friendlier one.
      const won = Math.random() < COINFLIP_WIN_PROBABILITY;
      const outcome: "win" | "loss" = won ? "win" : "loss";
      const wagerLamports = Math.round(wagerSol * LAMPORTS_PER_SOL);
      const payoutLamports = won ? wagerLamports * 2 : 0;

      if (won) setBalanceSol((b) => b + wagerSol * 2);

      setResult({
        outcome,
        wagerLamports,
        payoutLamports,
        payoutSignature: null,
        serverSeed,
        commitHash,
      });
      setFlips((f) => [{ side, wagerSol, outcome, at: Date.now() }, ...f].slice(0, 20));
      setStatus("resolved");
      setMessage(
        won
          ? `You doubled it! +${(wagerSol * 2).toFixed(4)} demo SOL.`
          : "Zeroed. Better luck next flip."
      );
    },
    [balanceSol]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setResult(null);
  }, []);

  const resetBalance = useCallback(() => {
    setBalanceSol(STARTING_BALANCE_SOL);
    setFlips([]);
    setStatus("idle");
    setMessage("");
    setResult(null);
  }, []);

  return { status, message, result, run, reset, balanceSol, flips, resetBalance };
}
