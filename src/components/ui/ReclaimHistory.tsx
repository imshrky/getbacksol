"use client";

import { ExternalLink, History } from "lucide-react";
import { useReclaimHistory } from "@/lib/useReclaimHistory";
import { NETWORK } from "@/app/providers";

const IS_MAINNET = NETWORK === "mainnet-beta";

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function shortenSignature(signature: string) {
  return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
}

function solscanUrl(signature: string) {
  return IS_MAINNET
    ? `https://solscan.io/tx/${signature}`
    : `https://solscan.io/tx/${signature}?cluster=devnet`;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Public feed of real reclaim transactions, every one linking out to
 * Solscan so it's independently verifiable, not just a number we claim.
 * Same transparency principle as the Security section's "verify the code
 * yourself on GitHub".
 */
export function ReclaimHistory() {
  const rows = useReclaimHistory();

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-medium">Recent reclaims</p>
      </div>

      {!rows ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No reclaims recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">Wallet</th>
                <th className="pb-2 pr-3 font-medium">Accounts</th>
                <th className="pb-2 pr-3 font-medium">Received</th>
                <th className="pb-2 pr-3 font-medium">Signature</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.txSignature}>
                  <td className="py-2 pr-3 font-mono">{shortenAddress(row.wallet)}</td>
                  <td className="py-2 pr-3">{row.accountsClosed}</td>
                  <td className="py-2 pr-3">{row.netSol.toFixed(6)} SOL</td>
                  <td className="py-2 pr-3">
                    <a
                      href={solscanUrl(row.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[var(--accent)] hover:underline"
                    >
                      {shortenSignature(row.txSignature)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </td>
                  <td className="py-2 whitespace-nowrap text-[var(--muted)]">
                    {formatTimestamp(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
