"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_POOLS } from "@/lib/mockTokens";

export default function RemoveLiquidityPage() {
  const [selectedPool, setSelectedPool] = useState(MOCK_POOLS[0].pair);
  const [percent, setPercent] = useState(50);
  const { status, message, run } = useSimulatedTx();

  const pool = MOCK_POOLS.find((p) => p.pair === selectedPool)!;

  return (
    <div className="fade-in">
      <SectionTitle
        index="05"
        eyebrow="Liquidity"
        title="Remove liquidity"
        description="Withdraw your share of a pool back into both underlying tokens."
      />

      <Card className="mx-auto max-w-lg">
        <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Pool</label>
        <select
          className="field-input"
          value={selectedPool}
          onChange={(e) => setSelectedPool(e.target.value)}
        >
          {MOCK_POOLS.map((p) => (
            <option key={p.pair} value={p.pair}>
              {p.pair} — {p.myLiquidity}
            </option>
          ))}
        </select>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">Amount to remove</span>
            <span className="text-2xl font-semibold">{percent}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="mt-2 flex gap-2">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setPercent(p)}
                className="flex-1 rounded-[3px] border border-[var(--border)] py-1.5 text-xs hover:border-[var(--accent)]"
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-2 rounded-[4px] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Pool</span>
            <span>{pool.pair}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Your current LP</span>
            <span>{pool.myLiquidity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Pool share</span>
            <span>{pool.share}</span>
          </div>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={status === "pending"}
          onClick={() => run(`Removed ${percent}% of your liquidity from ${pool.pair}.`)}
        >
          {status === "pending" ? "Removing liquidity…" : "Remove Liquidity"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>
    </div>
  );
}
