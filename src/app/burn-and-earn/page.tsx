"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TokenSelect } from "@/components/ui/TokenSelect";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_TOKENS } from "@/lib/mockTokens";

// Illustrative reward ratio for the mockup only — a real deployment would
// pull this from an on-chain rewards program / config account.
const REWARD_RATE = 0.015;

const HISTORY = [
  { date: "2026-07-06", token: "NEBU", burned: "12,000", reward: "180 pts" },
  { date: "2026-07-02", token: "FLOKI", burned: "5,400", reward: "81 pts" },
];

export default function BurnAndEarnPage() {
  const [token, setToken] = useState(MOCK_TOKENS[1]);
  const [amount, setAmount] = useState("");
  const { status, message, run } = useSimulatedTx();

  const projectedReward = useMemo(() => {
    const value = Number(amount);
    if (!value) return 0;
    return Math.round(value * REWARD_RATE);
  }, [amount]);

  return (
    <div className="fade-in">
      <SectionTitle
        index="07"
        eyebrow="Burn & Earn"
        title="Burn tokens, earn rewards"
        description="Burning tokens reduces supply and earns you points toward the leaderboard and future reward drops."
      />

      <Card className="mx-auto max-w-lg">
        <TokenSelect label="Token" value={token} onChange={setToken} />

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
            Amount to burn
          </label>
          <input
            type="number"
            placeholder="0.0"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mt-5 flex items-center justify-between rounded-[4px] border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-[var(--foreground)]">
            <Trophy className="h-4 w-4 text-[var(--accent)]" /> Projected reward
          </span>
          <span className="font-semibold">{projectedReward.toLocaleString()} pts</span>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!Number(amount) || status === "pending"}
          onClick={() =>
            run(`Burned ${amount} ${token.symbol} — earned ${projectedReward.toLocaleString()} pts.`)
          }
        >
          {status === "pending" ? "Processing…" : "Burn & Earn"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>

      <section className="mx-auto mt-16 max-w-lg">
        <h2 className="mb-4 text-center text-xl font-semibold">Your burn history</h2>
        <div className="overflow-hidden rounded-[6px] border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Burned</th>
                <th className="px-4 py-3">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {HISTORY.map((h) => (
                <tr key={h.date + h.token}>
                  <td className="px-4 py-3 text-[var(--muted)]">{h.date}</td>
                  <td className="px-4 py-3 font-medium">{h.token}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{h.burned}</td>
                  <td className="px-4 py-3 text-[var(--accent)]">{h.reward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
