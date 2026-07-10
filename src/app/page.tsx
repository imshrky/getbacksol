"use client";

import { useMemo, useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_RENT_ACCOUNTS, RECLAIM_FEE_RATE } from "@/lib/mockTokens";

function accountLabel(count: number) {
  return `${count} account${count === 1 ? "" : "s"}`;
}

export default function HomePage() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(MOCK_RENT_ACCOUNTS.map((a) => a.id))
  );
  const [safeBurn, setSafeBurn] = useState(true);
  const { status, message, run } = useSimulatedTx();

  const allSelected = selected.size === MOCK_RENT_ACCOUNTS.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(MOCK_RENT_ACCOUNTS.map((a) => a.id)));
  }

  const { gross, fee, net, count } = useMemo(() => {
    const chosen = MOCK_RENT_ACCOUNTS.filter((a) => selected.has(a.id));
    const grossVal = chosen.reduce((sum, a) => sum + a.reclaimable, 0);
    const feeVal = grossVal * RECLAIM_FEE_RATE;
    return { gross: grossVal, fee: feeVal, net: grossVal - feeVal, count: chosen.length };
  }, [selected]);

  return (
    <div className="fade-in">
      <SectionTitle
        index="01"
        eyebrow="GetBackSOL"
        title="Get back the SOL trapped in dead accounts"
        description="Every Solana token account locks a small SOL deposit. Close the empty ones and get it back — minus a service fee."
      />

      <Card className="mx-auto max-w-2xl !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Select all ({MOCK_RENT_ACCOUNTS.length} closable accounts found)
          </label>
          <span className="text-xs text-[var(--muted)]">{accountLabel(count)} selected</span>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="w-10 px-5 py-2.5"></th>
              <th className="px-2 py-2.5">Token account</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Reclaimable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {MOCK_RENT_ACCOUNTS.map((a) => (
              <tr key={a.id} className="surface-hover">
                <td className="px-5 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleOne(a.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="px-2 py-2.5">
                  <span className="font-medium">{a.symbol}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--muted)]">{a.mint}</span>
                </td>
                <td className="px-2 py-2.5 text-xs">
                  {a.status === "empty" ? (
                    <span className="text-[var(--muted)]">Empty</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[var(--accent)]">
                      <Flame className="h-3 w-3" /> Dust · {a.dustAmount}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right text-[var(--muted)]">
                  {a.reclaimable.toFixed(6)} SOL
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-[var(--border)] p-5">
          <Toggle
            checked={safeBurn}
            onChange={setSafeBurn}
            label="Safe-Burn + Sell dust balances first"
            hint="Burns worthless leftover token dust before closing, so more accounts qualify for a refund."
          />

          <div className="mt-5 space-y-1.5 rounded-[4px] bg-[var(--surface-2)] px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Gross reclaimable ({count} accounts)</span>
              <span>{gross.toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Service fee ({(RECLAIM_FEE_RATE * 100).toFixed(0)}%)</span>
              <span>−{fee.toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-semibold">
              <span>You receive</span>
              <span>{net.toFixed(6)} SOL</span>
            </div>
          </div>

          <button
            className="btn-primary mt-5 w-full"
            disabled={count === 0 || status === "pending"}
            onClick={() =>
              run(`Closed ${count} account${count > 1 ? "s" : ""} — ${net.toFixed(6)} SOL sent to your wallet.`)
            }
          >
            {status === "pending" ? "Closing accounts…" : `Close ${accountLabel(count)} & Reclaim SOL`}
          </button>

          <TxStatusBanner status={status} message={message} />
        </div>
      </Card>

      <section className="mx-auto mt-16 max-w-2xl">
        <div className="flex items-start gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>
            Closing an account is a standard, one-way Solana Token Program instruction — it only
            works on accounts with a zero balance, so it never touches tokens that still hold
            value. Each closed account returns its fixed rent-exempt reserve (~0.00204 SOL)
            directly to your wallet.
          </span>
        </div>
      </section>
    </div>
  );
}
