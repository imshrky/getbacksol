"use client";

import { useState } from "react";
import { Users, Copy, Check } from "lucide-react";
import { useAffiliateStats } from "@/lib/useAffiliateStats";

/**
 * Shown to any connected wallet — every wallet is automatically its own
 * affiliate, no signup. The link just carries `?ref=<address>` (see
 * referral.ts / relay-close's resolveOrCreateWalletAffiliate); sharing it
 * costs nothing and only ever earns a credit, never a liability.
 */
export function AffiliateBanner({ address }: { address: string }) {
  const stats = useAffiliateStats(address);
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${address}` : "";

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2.5 sm:min-w-0 sm:flex-1">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Earn 30% by sharing your link</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {stats && stats.referralCount > 0
              ? `${stats.totalEarnedSol.toFixed(6)} SOL earned from ${stats.referralCount} referral${
                  stats.referralCount > 1 ? "s" : ""
                } so far.`
              : "Anyone who reclaims SOL through your link earns you 30% of our fee — automatically."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <code className="field-input !w-full min-w-0 overflow-x-auto whitespace-nowrap text-xs sm:!w-60">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn-outline flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
