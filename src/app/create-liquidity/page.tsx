"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Faq } from "@/components/ui/Faq";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { useCreatePool } from "@/lib/useCreatePool";
import { POOL_CREATION_FEE_LAMPORTS, RAYDIUM_PROTOCOL_FEE_SOL } from "@/lib/raydiumPool";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Off by default — this moves real liquidity (your tokens + real SOL) into
// a real on-chain pool, irreversibly. Set NEXT_PUBLIC_RAYDIUM_POOL_LIVE to
// "true" on Vercel only after testing with a real wallet and tiny amounts
// (see docs/TOWER-TODO.md) — unlike the Token Creator's kill-switch, this
// one defaults closed, not open.
const RAYDIUM_POOL_LIVE = process.env.NEXT_PUBLIC_RAYDIUM_POOL_LIVE === "true";

const OUR_FEE_SOL = POOL_CREATION_FEE_LAMPORTS / LAMPORTS_PER_SOL;

const FAQ_ITEMS = [
  {
    q: "What does creating a pool actually do?",
    a: "It pairs your SPL token with native SOL in a real Raydium CPMM (constant-product) pool, seeded with the amounts you choose from your own wallet. That pool is what lets anyone buy or sell your token — without one, your token can't be traded anywhere.",
  },
  {
    q: "How does Jupiter pick it up?",
    a: "Automatically. Any token with a valid pool on a Jupiter-integrated DEX like Raydium is detected within minutes, logo and all (from the same metadata attached at token creation). Nothing to submit or apply for separately.",
  },
  {
    q: "What does it cost?",
    a: `Raydium's own protocol fee for creating a pool (currently ~${RAYDIUM_PROTOCOL_FEE_SOL} SOL, set by Raydium, not us) plus our ${OUR_FEE_SOL} SOL platform fee — both shown before you sign, on top of the tokens and SOL you're choosing to seed the pool with. You keep 100% of the LP position; nothing here is custodial.`,
  },
  {
    q: "Is this reversible?",
    a: "No. Once the pool exists on-chain, it exists permanently — you can withdraw your liquidity later, but the pool itself can't be deleted. Double-check the amounts before signing.",
  },
  {
    q: "Do I need to revoke freeze authority first?",
    a: "Yes — Raydium (and most aggregators) won't route through a pool whose token can still be frozen by its creator. Revoke it in the Token Creator before coming here.",
  },
];

export default function CreateLiquidityPage() {
  const [tokenMint, setTokenMint] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [solAmount, setSolAmount] = useState("");
  const { status, message, poolId, run } = useCreatePool();

  // Prefill from Token Creator's "Add liquidity" link (?mint=<address>) —
  // same window.location.search pattern used for referral links elsewhere
  // in the app (see src/lib/referral.ts), not next/navigation's
  // useSearchParams, to avoid a Suspense-boundary requirement for something
  // this simple.
  useEffect(() => {
    const mint = new URLSearchParams(window.location.search).get("mint");
    if (mint) setTokenMint(mint);
  }, []);

  useEffect(() => {
    if (!tokenMint.trim()) {
      setTokenSymbol(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/token-meta?address=${encodeURIComponent(tokenMint.trim())}`)
      .then((r) => r.json())
      .then((meta) => {
        if (!cancelled) setTokenSymbol(meta?.symbol ?? null);
      })
      .catch(() => {
        if (!cancelled) setTokenSymbol(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenMint]);

  const canSubmit = tokenMint.trim().length > 0 && Number(tokenAmount) > 0 && Number(solAmount) > 0;

  return (
    <div className="fade-in">
      <SectionTitle
        index="03"
        eyebrow="Liquidity"
        title="Create a liquidity pool"
        description="Pair your token with SOL in a real Raydium pool so people can trade it. Freeze authority must be revoked first."
      />

      {!RAYDIUM_POOL_LIVE && (
        <div className="mx-auto mb-6 flex max-w-xl items-start gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>
            Native pool creation is being tested and isn&apos;t open yet. In the meantime, add
            liquidity directly on{" "}
            <a
              href="https://raydium.io/liquidity/create-pool/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              raydium.io
            </a>{" "}
            using your token&apos;s mint address.
          </span>
        </div>
      )}

      <Card className="mx-auto max-w-xl">
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Your token&apos;s mint address
            </label>
            <input
              className="field-input"
              placeholder="Paste your SPL token mint address"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value.trim())}
            />
            {tokenSymbol && <p className="mt-1 text-xs text-[var(--muted)]">Detected: {tokenSymbol}</p>}
            <input
              type="number"
              placeholder="0.0"
              className="field-input mt-3"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">Amount of your token to seed the pool with.</p>
          </div>

          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">SOL</label>
            <input
              type="number"
              placeholder="0.0"
              className="field-input"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">Amount of SOL to pair against it.</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Raydium protocol fee</span>
            <span>~{RAYDIUM_PROTOCOL_FEE_SOL} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Platform fee</span>
            <span>{OUR_FEE_SOL} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Pool share</span>
            <span>100% (new pool)</span>
          </div>
        </div>

        <button
          className="btn-primary mt-5 w-full"
          disabled={!RAYDIUM_POOL_LIVE || !canSubmit || status === "pending"}
          onClick={() => run({ tokenMint: tokenMint.trim(), tokenAmount, solAmount })}
        >
          {!RAYDIUM_POOL_LIVE
            ? "Temporarily unavailable"
            : status === "pending"
              ? "Creating pool…"
              : "Create Liquidity Pool"}
        </button>

        <TxStatusBanner status={status} message={message} />

        {status === "success" && poolId && (
          <div className="mt-4 rounded-[10px] border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-5">
            <h3 className="text-sm font-semibold">Pool created</h3>
            <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-[var(--surface-2)] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{poolId}</span>
            </div>
            <a
              href={`https://solscan.io/account/${poolId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              View on Solscan
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              Jupiter and other aggregators should pick up the pool automatically within minutes.
            </p>
          </div>
        )}
      </Card>

      <section className="mx-auto mt-16 max-w-xl">
        <h2 className="mb-5 text-center text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={FAQ_ITEMS} />
      </section>
    </div>
  );
}
