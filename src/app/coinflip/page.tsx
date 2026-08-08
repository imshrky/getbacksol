"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Faq } from "@/components/ui/Faq";
import { useCoinflip, type CoinflipSide } from "@/lib/useCoinflip";
import { COINFLIP_PRESET_AMOUNTS_SOL, COINFLIP_RTP } from "@/lib/coinflipConfig";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Off by default — this is real-money wagering, not a fee-taking utility
// like the rest of the site. Set NEXT_PUBLIC_COINFLIP_LIVE to "true" on
// Vercel only once FEE_WALLET_SECRET_KEY is configured and you've tested
// with tiny amounts. Same off-by-default posture as the Raydium pool
// creator, for the same reason: this moves real money irreversibly.
const COINFLIP_LIVE = process.env.NEXT_PUBLIC_COINFLIP_LIVE === "true";

const RISK_ACK_KEY = "coinflip-risk-ack";

type RecentFlip = { wallet: string; side: string; wagerLamports: string; outcome: string; createdAt: string };

function shortWallet(w: string) {
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const FAQ_ITEMS = [
  {
    q: "Is this really real money?",
    a: "Yes. You wager real SOL from your own wallet. Winning pays out double automatically; losing means the wager is gone. There is no simulated or practice mode.",
  },
  {
    q: "How is the outcome decided?",
    a: `A commit-reveal scheme: before you bet, the server generates a secret seed and shows you only its hash. After you bet, the outcome is computed from that seed plus your own client seed, and the original seed is revealed so you (or anyone) can independently recompute the result and confirm it matches — the server can't change the outcome after seeing your bet, because it already committed to the hash first.`,
  },
  {
    q: "What are the odds?",
    a: `${(COINFLIP_RTP * 100).toFixed(0)}% RTP (return to player) — over many flips, that's the average share of everything wagered that comes back out. Each flip is independent; past results don't affect future ones.`,
  },
  {
    q: "Can I lose everything?",
    a: "Yes, on any single flip, every time. Only wager SOL you're fully prepared to lose. This is a game of chance, not an investment.",
  },
];

export default function CoinflipPage() {
  const [ackRisk, setAckRisk] = useState(false);
  const [amount, setAmount] = useState<number>(COINFLIP_PRESET_AMOUNTS_SOL[0]);
  const [side, setSide] = useState<CoinflipSide>("heads");
  const [flips, setFlips] = useState<RecentFlip[]>([]);
  const { status, message, result, run, reset } = useCoinflip();

  useEffect(() => {
    setAckRisk(window.localStorage.getItem(RISK_ACK_KEY) === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coinflip/history")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setFlips(body?.flips ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [result]);

  function acceptRisk() {
    window.localStorage.setItem(RISK_ACK_KEY, "true");
    setAckRisk(true);
  }

  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Coinflip"
        title="Flip for it"
        description="A real-money game of chance. Wager SOL from your own wallet, pick a side, double it or lose it."
      />

      {!ackRisk ? (
        <Card className="mx-auto max-w-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">Before you play</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>This is a real-money game of chance, not an investment. The outcome is random.</li>
            <li>You can lose the entire amount wagered, on any flip, every time.</li>
            <li>Only play with SOL you&apos;re fully prepared to lose. Never funds you need.</li>
            <li>All on-chain transactions are final — nothing here can be reversed or refunded.</li>
            <li>You confirm you are of legal age and that this is permitted in your jurisdiction.</li>
          </ul>
          <button className="btn-primary mt-5 w-full" onClick={acceptRisk}>
            I understand the risk — continue
          </button>
        </Card>
      ) : (
        <Card className="mx-auto max-w-lg">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">Wager</p>
              <div className="grid grid-cols-3 gap-2">
                {COINFLIP_PRESET_AMOUNTS_SOL.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors ${
                      amount === preset
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {preset} SOL
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">Pick a side</p>
              <div className="grid grid-cols-2 gap-2">
                {(["heads", "tails"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`rounded-[8px] border px-3 py-3 text-sm font-medium capitalize transition-colors ${
                      side === s
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-sm">
              <span className="text-[var(--muted)]">Win pays</span>
              <span className="font-semibold">{(amount * 2).toFixed(2)} SOL</span>
            </div>

            <button
              className="btn-primary w-full"
              disabled={!COINFLIP_LIVE || status === "pending"}
              onClick={() => {
                reset();
                run(side, amount);
              }}
            >
              {!COINFLIP_LIVE ? "Temporarily unavailable" : status === "pending" ? "Flipping…" : `Flip for ${amount} SOL`}
            </button>

            {status === "error" && (
              <div className="rounded-[8px] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {message}
              </div>
            )}
            {status === "needs-wallet" && (
              <div className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                {message}
              </div>
            )}

            {status === "resolved" && result && (
              <div
                className={`rounded-[10px] border p-5 ${
                  result.outcome === "win"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <h3 className={`text-sm font-semibold ${result.outcome === "win" ? "text-emerald-400" : "text-red-400"}`}>
                  {result.outcome === "win" ? "You doubled it!" : "Zeroed"}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
                {result.payoutSignature && (
                  <a
                    href={`https://solscan.io/tx/${result.payoutSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
                  >
                    View payout on Solscan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <details className="mt-3 text-xs text-[var(--muted)]">
                  <summary className="cursor-pointer">Verify this flip was fair</summary>
                  <p className="mt-2 break-all">Commit hash: {result.commitHash}</p>
                  <p className="mt-1 break-all">Revealed server seed: {result.serverSeed}</p>
                  <p className="mt-1">sha256(server seed) should equal the commit hash above.</p>
                </details>
              </div>
            )}
          </div>
        </Card>
      )}

      {flips.length > 0 && (
        <section className="mx-auto mt-10 max-w-lg">
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Recent flips</h2>
          <div className="space-y-1.5">
            {flips.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <span className="font-mono text-[var(--muted)]">{shortWallet(f.wallet)}</span>
                <span>
                  flipped {(Number(f.wagerLamports) / LAMPORTS_PER_SOL).toFixed(2)} SOL and{" "}
                  {f.outcome === "win" ? (
                    <span className="text-emerald-400">doubled!</span>
                  ) : (
                    <span className="text-red-400">zeroed :(</span>
                  )}
                </span>
                <span className="text-[var(--muted)]">{timeAgo(f.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 max-w-lg">
        <h2 className="mb-5 text-center text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={FAQ_ITEMS} />
      </section>
    </div>
  );
}
