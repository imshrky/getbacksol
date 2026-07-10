"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { MOCK_TOKENS, type MockToken } from "@/lib/mockTokens";

export function TokenSelect({
  value,
  onChange,
  label,
}: {
  value: MockToken;
  onChange: (t: MockToken) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {label && <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
      >
        <span className="flex items-center gap-2">
          <span className={`h-5 w-5 rounded-full bg-gradient-to-br ${value.icon}`} />
          <span className="font-medium">{value.symbol}</span>
          <span className="text-xs text-[var(--muted)]">{value.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {MOCK_TOKENS.map((t) => (
            <button
              key={t.symbol}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm surface-hover"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                <span className={`h-5 w-5 rounded-full bg-gradient-to-br ${t.icon}`} />
                <span className="font-medium">{t.symbol}</span>
                <span className="text-xs text-[var(--muted)]">{t.name}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                {t.balance.toLocaleString()}
                {t.symbol === value.symbol && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
