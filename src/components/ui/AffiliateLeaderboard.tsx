"use client";

import { Trophy } from "lucide-react";
import { useAffiliateLeaderboard } from "@/lib/useAffiliateLeaderboard";

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Public top-5 wallet affiliates by total earned — same 30% rate as every
 * affiliate (see AffiliateBanner), this just surfaces who's referred the
 * most as a visible incentive. Scoped to wallet-kind affiliates only (see
 * getAffiliateLeaderboard).
 */
export function AffiliateLeaderboard({ currentWallet }: { currentWallet?: string }) {
  const entries = useAffiliateLeaderboard();

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-medium">Top affiliates</p>
      </div>

      {!entries ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No referrals yet — share your link above to take the first spot.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, i) => {
            const isYou = currentWallet && entry.walletAddress === currentWallet;
            return (
              <li
                key={entry.walletAddress}
                className={`flex items-center justify-between rounded-[8px] px-3 py-2 text-sm ${
                  isYou ? "bg-[var(--accent)]/10 text-[var(--foreground)]" : "text-[var(--muted)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-xs font-semibold">{i + 1}</span>
                  <span className="font-mono text-xs">{shortenAddress(entry.walletAddress)}</span>
                  {isYou && <span className="pill">You</span>}
                </span>
                <span className="shrink-0 text-xs">
                  {entry.totalEarnedSol.toFixed(6)} SOL · {entry.referralCount} referral
                  {entry.referralCount > 1 ? "s" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
