"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Settings2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TokenSelect } from "@/components/ui/TokenSelect";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_TOKENS } from "@/lib/mockTokens";

// Illustrative fixed rate for the mockup only.
const MOCK_RATE = 0.0000431;

export default function SwapPage() {
  const [fromToken, setFromToken] = useState(MOCK_TOKENS[0]);
  const [toToken, setToToken] = useState(MOCK_TOKENS[1]);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const { status, message, run } = useSimulatedTx();

  const estimated = useMemo(() => {
    const value = Number(amount);
    if (!value) return "0.0";
    return (value / MOCK_RATE).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, [amount]);

  function flip() {
    setFromToken(toToken);
    setToToken(fromToken);
  }

  return (
    <div className="fade-in">
      <SectionTitle
        index="04"
        eyebrow="Swap"
        title="Swap tokens instantly"
        description="Trade between SPL tokens at the best available route. Rates shown are illustrative."
      />

      <Card className="mx-auto max-w-lg">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Slippage tolerance</span>
          <div className="flex gap-1">
            {[0.1, 0.5, 1].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`rounded-[6px] border px-2.5 py-1 ${
                  slippage === s
                    ? "border-[var(--accent)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {s}%
              </button>
            ))}
            <button className="rounded-[6px] border border-[var(--border)] p-1.5 text-[var(--muted)]">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>You pay</span>
            <button onClick={() => setAmount(String(fromToken.balance))}>
              Balance: {fromToken.balance.toLocaleString()}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.0"
              className="field-input flex-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="w-40">
              <TokenSelect value={fromToken} onChange={setFromToken} />
            </div>
          </div>
        </div>

        <div className="flex justify-center py-1">
          <button
            onClick={flip}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--background)] hover:border-[var(--accent)]"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>You receive</span>
            <span>Balance: {toToken.balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              placeholder="0.0"
              className="field-input flex-1 opacity-80"
              value={amount ? estimated : ""}
            />
            <div className="w-40">
              <TokenSelect value={toToken} onChange={setToToken} />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted)]">
          <div className="flex justify-between">
            <span>Rate</span>
            <span>
              1 {fromToken.symbol} ≈ {(1 / MOCK_RATE).toLocaleString()} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Route</span>
            <span>
              {fromToken.symbol} → {toToken.symbol} (1 hop)
            </span>
          </div>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!Number(amount) || status === "pending"}
          onClick={() => run(`Swapped ${amount} ${fromToken.symbol} for ${estimated} ${toToken.symbol}.`)}
        >
          {status === "pending" ? "Swapping…" : "Swap"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>
    </div>
  );
}
