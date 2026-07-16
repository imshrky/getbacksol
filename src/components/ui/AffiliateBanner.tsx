"use client";

import { useState } from "react";
import { Users, Copy, Check, X as XIcon, Send } from "lucide-react";
import { useAffiliateStats } from "@/lib/useAffiliateStats";
import { trackEvent } from "@/lib/analytics";

const SHARE_TEXT =
  "Your Solana wallet might be holding locked SOL in old, empty token accounts. Reclaim it in seconds, and we both earn:";

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
  const xShareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`${SHARE_TEXT} ${link}`)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
    SHARE_TEXT
  )}`;

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    trackEvent("referral_link_shared", { wallet: address, method: "copy" });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-2.5">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Earn 60% by sharing your link</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {stats && stats.referralCount > 0
              ? `${stats.totalEarnedSol.toFixed(6)} SOL earned from ${stats.referralCount} referral${
                  stats.referralCount > 1 ? "s" : ""
                } so far.`
              : "Anyone who reclaims SOL through your link earns you 60% of our fee, automatically."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="field-input min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn-outline flex w-full shrink-0 items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:w-[92px]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row">
        <a
          href={xShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("referral_link_shared", { wallet: address, method: "x" })}
          className="btn-outline flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs"
        >
          <XIcon className="h-3.5 w-3.5" />
          Share on X
        </a>
        <a
          href={telegramShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("referral_link_shared", { wallet: address, method: "telegram" })}
          className="btn-outline flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs"
        >
          <Send className="h-3.5 w-3.5" />
          Share on Telegram
        </a>
      </div>
    </div>
  );
}
