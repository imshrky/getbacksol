"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CoinflipSide } from "@/lib/useCoinflip";

/**
 * The flipping coin on /coinflip.
 *
 * Which face it lands on is derived, not random: the side the player picked
 * is cosmetic as far as the odds go (see coinflipConfig.ts — both sides carry
 * the same win probability), so the coin lands on their chosen side when they
 * win and on the other side when they lose. That keeps the picture and the
 * result honest with each other; showing an independently random face would
 * mean a player could "win" while visibly landing on the side they didn't
 * pick.
 */
export function Coin({
  spinning,
  chosenSide,
  outcome,
}: {
  spinning: boolean;
  chosenSide: CoinflipSide;
  outcome: "win" | "loss" | null;
}) {
  // Accumulates so every turn rotates forward rather than unwinding
  // backwards to a lower angle, which reads as the coin flipping in reverse.
  const [rotation, setRotation] = useState(0);
  const wasSpinning = useRef(false);
  const prevSide = useRef(chosenSide);

  const landedSide: CoinflipSide =
    outcome === null ? chosenSide : outcome === "win" ? chosenSide : chosenSide === "heads" ? "tails" : "heads";

  /** Next angle showing `face`, always at least `minTurns` further forward. */
  function advanceTo(prev: number, face: CoinflipSide, minTurns: number) {
    const target = face === "heads" ? 0 : 180;
    const base = Math.ceil((prev + minTurns * 360) / 360) * 360;
    return base + target;
  }

  // Landing: settle on whichever face the result calls for.
  useEffect(() => {
    if (spinning) {
      wasSpinning.current = true;
      return;
    }
    if (!wasSpinning.current) return;
    wasSpinning.current = false;
    prevSide.current = chosenSide;
    setRotation((prev) => advanceTo(prev, landedSide, 2));
  }, [spinning, landedSide, chosenSide]);

  // Picking a side turns the coin to show it, so the choice is visible
  // before committing to a wager rather than only after the result.
  useEffect(() => {
    if (spinning || prevSide.current === chosenSide) return;
    prevSide.current = chosenSide;
    setRotation((prev) => advanceTo(prev, chosenSide, 1));
  }, [chosenSide, spinning]);

  return (
    <div className="coin-scene flex justify-center py-2">
      <div
        className={`coin-inner h-24 w-24 ${spinning ? "is-spinning" : ""}`}
        style={spinning ? undefined : { transform: `rotateY(${rotation}deg)` }}
        aria-hidden="true"
      >
        {/* Heads carries Lockit, tails is left plain — the faces need telling
            apart at a glance mid-spin, so they differ in colour and content
            rather than only in their label. Heads sits on the light ground so
            the red character reads against it instead of disappearing. */}
        <CoinFace label="Heads">
          <Image
            src="/lockit/head.png"
            alt=""
            width={163}
            height={191}
            priority
            className="h-12 w-auto drop-shadow-sm"
          />
        </CoinFace>
        <CoinFace label="Tails" back />
      </div>
    </div>
  );
}

function CoinFace({
  label,
  back,
  children,
}: {
  label: string;
  back?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`coin-face ${back ? "coin-face-back" : ""} flex-col gap-0.5 border-2`}
      style={{
        borderColor: "var(--accent)",
        background: back ? "var(--accent)" : "var(--surface)",
        color: back ? "var(--accent-ink)" : "var(--muted)",
        boxShadow: "var(--shadow)",
      }}
    >
      {children}
      <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
    </div>
  );
}
