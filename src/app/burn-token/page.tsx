"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TokenSelect } from "@/components/ui/TokenSelect";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_TOKENS } from "@/lib/mockTokens";

export default function BurnTokenPage() {
  const [token, setToken] = useState(MOCK_TOKENS[1]);
  const [amount, setAmount] = useState("");
  const { status, message, run } = useSimulatedTx();

  return (
    <div className="fade-in">
      <SectionTitle
        index="06"
        eyebrow="Burn"
        title="Burn tokens"
        description="Permanently remove tokens from circulating supply. This action cannot be undone."
      />

      <Card className="mx-auto max-w-lg">
        <TokenSelect label="Token" value={token} onChange={setToken} />

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Amount to burn</span>
            <button onClick={() => setAmount(String(token.balance))}>
              Max: {token.balance.toLocaleString()}
            </button>
          </div>
          <input
            type="number"
            placeholder="0.0"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-[8px] border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-xs text-[var(--foreground)]">
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>
            Burning is irreversible. The tokens will be permanently removed from total supply and
            cannot be recovered.
          </span>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!Number(amount) || status === "pending"}
          onClick={() => run(`Burned ${amount} ${token.symbol}. Total supply reduced.`)}
        >
          {status === "pending" ? "Burning…" : "Burn Token"}
        </button>

        <TxStatusBanner status={status} message={message} />
      </Card>
    </div>
  );
}
