"use client";

import { Loader2, CheckCircle2, WalletMinimal, AlertTriangle } from "lucide-react";
import type { TxStatus } from "@/lib/useSimulatedTx";

export function TxStatusBanner({
  status,
  message,
  pendingText = "Simulating transaction…",
}: {
  status: TxStatus;
  message: string;
  pendingText?: string;
}) {
  if (status === "idle") return null;

  const config = {
    pending: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      className: "border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 text-[var(--accent-2)]",
      text: pendingText,
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      text: message,
    },
    "needs-wallet": {
      icon: <WalletMinimal className="h-4 w-4" />,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      text: message,
    },
    error: {
      icon: <AlertTriangle className="h-4 w-4" />,
      className: "border-red-500/40 bg-red-500/10 text-red-400",
      text: message,
    },
  } as const;

  const c = config[status as keyof typeof config];
  if (!c) return null;

  return (
    <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${c.className}`}>
      {c.icon}
      <span>{c.text}</span>
    </div>
  );
}
