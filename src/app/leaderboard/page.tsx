"use client";

import { Trophy, Medal } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { MOCK_LEADERBOARD } from "@/lib/mockTokens";

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];

export default function LeaderboardPage() {
  return (
    <div className="fade-in">
      <SectionTitle
        index="07"
        eyebrow="Leaderboard"
        title="Top burners"
        description="Ranked by total value burned across all tokens on the platform."
      />

      <Card className="mx-auto max-w-2xl !p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Wallet</th>
              <th className="px-5 py-3">Burned</th>
              <th className="px-5 py-3 text-right">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {MOCK_LEADERBOARD.map((row) => (
              <tr key={row.rank} className="surface-hover">
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {row.rank <= 3 ? (
                      <Medal className={`h-4 w-4 ${MEDAL_COLORS[row.rank - 1]}`} />
                    ) : (
                      <Trophy className="h-4 w-4 text-transparent" />
                    )}
                    #{row.rank}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs">{row.wallet}</td>
                <td className="px-5 py-3.5 text-[var(--muted)]">{row.burned}</td>
                <td className="px-5 py-3.5 text-right text-[var(--accent)]">{row.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-[var(--muted)]">
        Sample data shown. A live leaderboard requires an indexer that watches burn transactions
        on-chain and aggregates them per wallet — see the backend architecture doc.
      </p>
    </div>
  );
}
