"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Flame, FlaskConical, RotateCcw } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import Image from "next/image";
import { Coin } from "@/components/ui/Coin";
import { Faq } from "@/components/ui/Faq";
import { useCoinflip, type CoinflipSide } from "@/lib/useCoinflip";
import {
  COINFLIP_DEGEN_AMOUNTS_SOL,
  COINFLIP_PRESET_AMOUNTS_SOL,
  COINFLIP_RTP,
  isAmountAffordable,
} from "@/lib/coinflipConfig";
// --- DEMO SCAFFOLDING (temporary) — remove with useCoinflipDemo.ts ---
import { useCoinflipDemo } from "@/lib/useCoinflipDemo";
// --- end demo scaffolding ---

const LAMPORTS_PER_SOL = 1_000_000_000;

// Off by default — this is real-money wagering, not a fee-taking utility
// like the rest of the site. Set NEXT_PUBLIC_COINFLIP_LIVE to "true" on
// Vercel only once FEE_WALLET_SECRET_KEY is configured and you've tested
// with tiny amounts. Same off-by-default posture as the Raydium pool
// creator, for the same reason: this moves real money irreversibly.
const COINFLIP_LIVE = process.env.NEXT_PUBLIC_COINFLIP_LIVE === "true";

// --- DEMO SCAFFOLDING (temporary) ---
// Play-money preview for reviewing how the game feels before any real SOL
// is involved. Runs entirely in the browser — no wallet, no API call, no
// database write — so it cannot pay anyone even if it were left enabled by
// mistake. Ignored whenever real play is live, so the two can never be
// active at once. Delete this, useCoinflipDemo.ts, and the blocks marked
// "demo scaffolding" below once the feel is signed off.
const COINFLIP_DEMO = process.env.NEXT_PUBLIC_COINFLIP_DEMO === "true" && !COINFLIP_LIVE;
// --- end demo scaffolding ---

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
    // Kept honest in both modes: claiming "no practice mode exists" while a
    // practice mode is running would be exactly the kind of false statement
    // this site avoids everywhere else.
    a: COINFLIP_DEMO
      ? "Not right now. You're in a preview mode that uses play money only. No wallet is connected and nothing reaches the blockchain. In the live game you wager real SOL from your own wallet, winning pays out double automatically, and losing means the wager is gone."
      : "Yes. You wager real SOL from your own wallet. Winning pays out double automatically; losing means the wager is gone. There is no simulated or practice mode.",
  },
  {
    q: "How is the outcome decided?",
    a: `A commit-reveal scheme: before you bet, the server generates a secret seed and shows you only its hash. After you bet, the outcome is computed from that seed plus your own client seed, and the original seed is revealed so you (or anyone) can independently recompute the result and confirm it matches. The server can't change the outcome after seeing your bet, because it already committed to the hash first.`,
  },
  {
    q: "What are the odds?",
    a: `${(COINFLIP_RTP * 100).toFixed(0)}% RTP (return to player). Over many flips, that's the average share of everything wagered that comes back out. Each flip is independent; past results don't affect future ones.`,
  },
  {
    q: "Can I lose everything?",
    a: "Yes, on any single flip, every time. Only wager SOL you're fully prepared to lose. This is a game of chance, not an investment.",
  },
];

export default function CoinflipPage() {
  const [ackRisk, setAckRisk] = useState(false);
  const [degen, setDegen] = useState(false);
  const [amount, setAmount] = useState<number>(COINFLIP_PRESET_AMOUNTS_SOL[0]);
  const [side, setSide] = useState<CoinflipSide>("heads");
  const [flips, setFlips] = useState<RecentFlip[]>([]);
  // null means "capacity unknown" (endpoint unreachable), in which case the
  // server stays the authority rather than the UI blocking play.
  const [maxWagerLamports, setMaxWagerLamports] = useState<number | null>(null);
  const real = useCoinflip();
  // --- DEMO SCAFFOLDING (temporary) ---
  // Both hooks are always called (React requires unconditional hook calls);
  // only one is ever driven, since COINFLIP_DEMO is false whenever real
  // play is live.
  const demo = useCoinflipDemo();
  const { status, message, result, run, reset } = COINFLIP_DEMO ? demo : real;
  // --- end demo scaffolding ---

  useEffect(() => {
    setAckRisk(window.localStorage.getItem(RISK_ACK_KEY) === "true");
  }, []);

  useEffect(() => {
    if (COINFLIP_DEMO) return; // demo keeps its own local history
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

  // What the house can actually pay out on right now. Refreshed after each
  // round, since a win drains the float. Skipped in demo mode, which never
  // touches the real bankroll.
  useEffect(() => {
    if (COINFLIP_DEMO) return;
    let cancelled = false;
    fetch("/api/coinflip/limits")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setMaxWagerLamports(body?.maxWagerLamports ?? null);
      })
      .catch(() => {
        if (!cancelled) setMaxWagerLamports(null);
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  const presets = degen ? COINFLIP_DEGEN_AMOUNTS_SOL : COINFLIP_PRESET_AMOUNTS_SOL;
  // In demo mode the house balance is irrelevant, so nothing is ever gated.
  const affordable = (sol: number) =>
    COINFLIP_DEMO ? true : isAmountAffordable(sol, maxWagerLamports);
  const amountAffordable = affordable(amount);

  function toggleDegen() {
    const next = !degen;
    setDegen(next);
    // Snap to the first stake of the mode being switched into, so the
    // selected amount can never be one the visible buttons don't offer.
    setAmount(next ? COINFLIP_DEGEN_AMOUNTS_SOL[0] : COINFLIP_PRESET_AMOUNTS_SOL[0]);
    reset();
  }

  function acceptRisk() {
    window.localStorage.setItem(RISK_ACK_KEY, "true");
    setAckRisk(true);
  }

  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Coinflip"
        title="Flip for it"
        description={
          COINFLIP_DEMO
            ? "Preview mode, play money only. Same odds and same flow as the real game, but nothing here touches a wallet or the blockchain."
            : "A real-money game of chance. Wager SOL from your own wallet, pick a side, double it or lose it."
        }
      />

      {/* --- DEMO SCAFFOLDING (temporary) --- */}
      {COINFLIP_DEMO && (
        <div className="mx-auto mb-6 flex max-w-lg items-center justify-between gap-4 rounded-[10px] border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Demo mode: no real SOL</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Balance: {demo.balanceSol.toFixed(4)} demo SOL
              </p>
            </div>
          </div>
          <button
            onClick={demo.resetBalance}
            className="btn-outline flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      )}
      {/* --- end demo scaffolding --- */}

      {!ackRisk ? (
        <Card className="mx-auto max-w-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">Before you play</h3>
          </div>
          {/* --- DEMO SCAFFOLDING (temporary) — the note below only --- */}
          {COINFLIP_DEMO && (
            <p className="mt-3 rounded-[8px] border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2 text-xs text-[var(--muted)]">
              Preview of the live game&apos;s warning screen. None of it applies right now. This
              session uses play money and never reaches a wallet or the blockchain.
            </p>
          )}
          {/* --- end demo scaffolding --- */}
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            <li>This is a real-money game of chance, not an investment. The outcome is random.</li>
            <li>You can lose the entire amount wagered, on any flip, every time.</li>
            <li>Only play with SOL you&apos;re fully prepared to lose. Never funds you need.</li>
            <li>All on-chain transactions are final. Nothing here can be reversed or refunded.</li>
            <li>You confirm you are of legal age and that this is permitted in your jurisdiction.</li>
          </ul>
          <button className="btn-primary mt-5 w-full" onClick={acceptRisk}>
            {COINFLIP_DEMO ? "Continue to the demo" : "I understand the risk, continue"}
          </button>
        </Card>
      ) : (
        <Card className="mx-auto max-w-lg">
          <div className="space-y-4">
            <Coin
              spinning={status === "pending"}
              chosenSide={side}
              outcome={status === "resolved" && result ? result.outcome : null}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--muted)]">Wager</p>
                <button
                  type="button"
                  onClick={toggleDegen}
                  aria-pressed={degen}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    degen
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  Degen mode
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => {
                  const ok = affordable(preset);
                  return (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      disabled={!ok}
                      // Stakes the house couldn't pay out on are shown but
                      // disabled, rather than hidden: seeing the ceiling is
                      // more honest than silently offering fewer options.
                      title={ok ? undefined : "The house can't cover this payout right now"}
                      className={`rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        amount === preset
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {preset} SOL
                    </button>
                  );
                })}
              </div>

              {!amountAffordable && (
                <p className="mt-2 text-xs text-amber-400">
                  The house can&apos;t cover a payout at this stake right now. Pick a smaller one.
                </p>
              )}
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
              disabled={(!COINFLIP_LIVE && !COINFLIP_DEMO) || status === "pending" || !amountAffordable}
              onClick={() => {
                reset();
                run(side, amount);
              }}
            >
              {!COINFLIP_LIVE && !COINFLIP_DEMO
                ? "Temporarily unavailable"
                : status === "pending"
                  ? "Flipping…"
                  : `Flip for ${amount} ${COINFLIP_DEMO ? "demo " : ""}SOL`}
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
                <div className="flex items-start gap-3">
                  {/* Thumbs-up on a win, visibly deflated on a loss. The 3D
                      sheet has no sad pose (every render wears the same
                      smile), so that one is a slumped sitting pose with the
                      mouth mirrored into a frown. Keyed on the round so the
                      entrance replays every flip, not just the first. */}
                  <Image
                    key={`${result.serverSeed}-${result.outcome}`}
                    src={result.outcome === "win" ? "/lockit/win.png" : "/lockit/sad.png"}
                    alt={
                      result.outcome === "win"
                        ? "Lockit giving a thumbs up"
                        : "Lockit looking sad after a loss"
                    }
                    width={187}
                    height={320}
                    // Eager, not lazy: this appears in direct response to the
                    // flip resolving, so it has to be on screen immediately —
                    // lazy-loading would fade it in a beat late, or not at all
                    // if the result sits below the fold.
                    loading="eager"
                    className="mascot-pop h-20 w-auto shrink-0"
                  />
                  <div className="min-w-0">
                    <h3
                      className={`text-sm font-semibold ${
                        result.outcome === "win" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {result.outcome === "win" ? "You doubled it!" : "Zeroed"}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {message}
                      {result.outcome === "loss" && " Your next flip has exactly the same odds."}
                    </p>
                  </div>
                </div>
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

      {/* --- DEMO SCAFFOLDING (temporary) --- */}
      {COINFLIP_DEMO && demo.flips.length > 0 && (
        <section className="mx-auto mt-10 max-w-lg">
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Your demo flips</h2>
          <div className="space-y-1.5">
            {demo.flips.map((f) => (
              <div
                key={f.at}
                className="flex items-center justify-between rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
              >
                <span className="capitalize text-[var(--muted)]">{f.side}</span>
                <span>
                  flipped {f.wagerSol.toFixed(2)} demo SOL and{" "}
                  {f.outcome === "win" ? (
                    <span className="text-emerald-400">doubled!</span>
                  ) : (
                    <span className="text-red-400">zeroed :(</span>
                  )}
                </span>
                <span className="text-[var(--muted)]">{timeAgo(new Date(f.at).toISOString())}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* --- end demo scaffolding --- */}

      {!COINFLIP_DEMO && flips.length > 0 && (
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
