"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TokenSelect } from "@/components/ui/TokenSelect";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_TOKENS, MOCK_POOLS } from "@/lib/mockTokens";

export default function CreateLiquidityPage() {
  const [tokenA, setTokenA] = useState(MOCK_TOKENS[1]);
  const [tokenB, setTokenB] = useState(MOCK_TOKENS[0]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const { status, message, run } = useSimulatedTx();

  const canSubmit = Number(amountA) > 0 && Number(amountB) > 0;

  return (
    <div className="fade-in">
      <SectionTitle
        index="03"
        eyebrow="Liquidity"
        title="Create a liquidity pool"
        description="Pair your token with SOL (or another asset) so people can trade it. Freeze authority must be revoked first."
      />

      <Card className="mx-auto max-w-xl">
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <TokenSelect label="Token A" value={tokenA} onChange={setTokenA} />
            <input
              type="number"
              placeholder="0.0"
              className="field-input mt-3"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Balance: {tokenA.balance.toLocaleString()} {tokenA.symbol}
            </p>
          </div>

          <div className="flex justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--background)]">
              <Plus className="h-4 w-4 text-[var(--muted)]" />
            </span>
          </div>

          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <TokenSelect label="Token B" value={tokenB} onChange={setTokenB} />
            <input
              type="number"
              placeholder="0.0"
              className="field-input mt-3"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Balance: {tokenB.balance.toLocaleString()} {tokenB.symbol}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Pool share</span>
            <span>100% (new pool)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Est. network fee</span>
            <span>~0.02 SOL</span>
          </div>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!canSubmit || status === "pending"}
          onClick={() =>
            run(`Pool ${tokenA.symbol}/${tokenB.symbol} created. LP tokens sent to your wallet.`)
          }
        >
          {status === "pending" ? "Creating pool…" : "Create Liquidity Pool"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>

      <section className="mx-auto mt-16 max-w-xl">
        <h2 className="mb-4 text-center text-xl font-semibold">Your liquidity positions</h2>
        <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Pair</th>
                <th className="px-4 py-3">My liquidity</th>
                <th className="px-4 py-3">Pool share</th>
                <th className="px-4 py-3">TVL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_POOLS.map((p) => (
                <tr key={p.pair}>
                  <td className="px-4 py-3 font-medium">{p.pair}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{p.myLiquidity}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{p.share}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{p.tvl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
