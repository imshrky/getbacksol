"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Wallet,
  ScanSearch,
  Coins,
  ShieldCheck,
  Lock,
  Eye,
  BadgeCheck,
  Code2,
  Loader2,
  AlertTriangle,
  PartyPopper,
  Flame,
  CheckCircle2,
  Rocket,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { Faq } from "@/components/ui/Faq";
import { ImpactStats } from "@/components/ui/ImpactStats";
import { AffiliateBanner } from "@/components/ui/AffiliateBanner";
import { ReclaimHistory } from "@/components/ui/ReclaimHistory";
import { WeeklyLeaderboard } from "@/components/ui/WeeklyLeaderboard";
import { useRentAccounts } from "@/lib/useRentAccounts";
import { useReclaimRent } from "@/lib/useReclaimRent";
import { usePortfolio } from "@/lib/usePortfolio";
import { RECLAIM_FEE_RATE, RENT_PER_ACCOUNT } from "@/lib/mockTokens";
import { NETWORK } from "@/app/providers";
import { captureReferral } from "@/lib/referral";
import { FAQ_ITEMS } from "@/lib/faqContent";

const IS_MAINNET = NETWORK === "mainnet-beta";

// A sample, not the full list — connect flow relies on the Solana Wallet
// Standard (see providers.tsx), which auto-detects any compliant wallet,
// not just the ones named here. This row exists so a first-time visitor
// sees recognizable names before connecting, not because the list is
// exhaustive.
const SUPPORTED_WALLETS = [
  "Phantom",
  "Solflare",
  "Backpack",
  "Coinbase Wallet",
  "OKX Wallet",
  "Ledger",
];

function accountLabel(count: number) {
  return `${count} account${count === 1 ? "" : "s"}`;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

const STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    body: "Phantom, Solflare or Backpack — connect in one click, non-custodial the whole way through.",
  },
  {
    icon: ScanSearch,
    title: "We scan for dead accounts",
    body: "We list every token account you own and identify the ones sitting at a zero balance, ready to close.",
  },
  {
    icon: Coins,
    title: "Close & get your SOL back",
    body: "Approve one transaction to close them and receive the locked rent, minus a 15% service fee.",
  },
];

const SECURITY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Non-custodial by design",
    body: "Every transaction is built by the app but signed only by your wallet. We never see, store, or touch your private keys.",
  },
  {
    icon: Lock,
    title: "Enforced on-chain, not by us",
    body: "The Solana Token Program itself rejects any attempt to close an account that still holds value — it's a network-level rule, not a promise our app makes.",
  },
  {
    icon: Eye,
    title: "Fees are explicit",
    body: "The exact amount you'll receive — gross, fee, net — is shown before you sign. The fee transfer happens in the same atomic transaction, nothing is deducted afterwards.",
  },
  {
    icon: BadgeCheck,
    title: "Externally audited",
    body: IS_MAINNET
      ? "GetBackSOL has passed an external security audit. The instructions are standard Token Program calls, not a custom program, reviewed before real funds moved through them."
      : "GetBackSOL has passed an external security audit ahead of this mainnet launch.",
  },
];


const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const SHIPPED_ACHIEVEMENTS = [
  { date: "Jul 2026", text: "Reclaim Rent live on Solana mainnet" },
  { date: "Jul 2026", text: "Safe-Burn: close dust accounts automatically" },
  { date: "Jul 2026", text: "Sell dust for SOL via Jupiter" },
  { date: "Jul 2026", text: "Self-service Partner Program" },
  { date: "Jul 2026", text: "Automatic wallet affiliate program" },
  { date: "Jul 2026", text: "External security audit passed" },
  { date: "Jul 2026", text: "Rate limiting on the Partner API" },
  { date: "Jul 2026", text: "Interactive Telegram bot — wallet checks, FAQ, menu" },
];

const ROADMAP_COLUMNS = [
  {
    status: "In progress",
    dotClassName: "bg-[var(--accent)]",
    items: [{ date: "Now", text: "Phantom dApp directory listing" }],
  },
  {
    status: "Planned",
    dotClassName: "bg-[var(--border-strong)]",
    items: [
      { date: "TBA", text: "Migrating the fee wallet to a Squads multisig" },
      { date: "TBA", text: "Taking the remaining tools (Swap, Liquidity, Token Creator...) live on mainnet" },
    ],
  },
];

export default function HomePage() {
  const { connected, publicKey, wallets } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Solana's Mobile Wallet Adapter (auto-injected by the library) only
  // covers Android — on iOS Safari with no wallet browser extension,
  // `wallets` stays empty and there's no way to connect at all unless we
  // hand the user off to a wallet app's own in-app browser, where Wallet
  // Standard injection works normally once they land back on this page.
  const isMobile = useSyncExternalStore(
    () => () => {},
    () =>
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      // iPadOS 13+ reports as "Macintosh" by default — the standard tell is
      // touch support, which no real Mac has.
      (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    () => false
  );

  const mobileWalletLinks = useMemo(() => {
    if (typeof window === "undefined") return { phantom: "", solflare: "" };
    const url = encodeURIComponent(window.location.href);
    return {
      phantom: `https://phantom.app/ul/browse/${url}?ref=${url}`,
      solflare: `https://solflare.com/ul/v1/browse/${url}?ref=${url}`,
    };
  }, []);
  const { accounts, dustAccounts, loading, error, refresh } = useRentAccounts();
  const { status, message, run } = useReclaimRent();
  const portfolio = usePortfolio();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"close" | "portfolio">("close");
  const [safeBurn, setSafeBurn] = useState(true);
  const [sellDust, setSellDust] = useState(false);

  const closableAccounts = useMemo(
    () => (safeBurn ? [...accounts, ...dustAccounts] : accounts),
    [accounts, dustAccounts, safeBurn]
  );

  // Every scanned account, always shown — dust rows are just greyed out and
  // unselectable while Safe-Burn is off, instead of disappearing.
  const displayAccounts = useMemo(() => [...accounts, ...dustAccounts], [accounts, dustAccounts]);

  useEffect(() => {
    setSelected(new Set(closableAccounts.map((a) => a.pubkey)));
  }, [closableAccounts]);

  // Capture a partner's `?ref=` attribution tag once on load, so a referred
  // reclaim still gets credited to them even after the wallet-connect flow.
  useEffect(() => {
    captureReferral();
  }, []);

  const allSelected = closableAccounts.length > 0 && selected.size === closableAccounts.length;

  function toggleOne(pubkey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(closableAccounts.map((a) => a.pubkey)));
  }

  const { gross, fee, net, count } = useMemo(() => {
    const chosen = closableAccounts.filter((a) => selected.has(a.pubkey));
    const grossVal = chosen.reduce((sum, a) => sum + a.reclaimable, 0);
    const feeVal = grossVal * RECLAIM_FEE_RATE;
    return { gross: grossVal, fee: feeVal, net: grossVal - feeVal, count: chosen.length };
  }, [closableAccounts, selected]);

  async function handleClose() {
    const chosen = closableAccounts.filter((a) => selected.has(a.pubkey));
    await run(chosen, { sellDust: safeBurn && sellDust });
    refresh();
  }

  const sortedHoldings = useMemo(
    () => [...portfolio.holdings].sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0)),
    [portfolio.holdings]
  );

  return (
    <div className="fade-in">
      {/* Hero + tool */}
      <section id="reclaim" className="scroll-mt-24 pb-16 pt-6 text-center sm:pb-20">
        <span className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--accent)]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          Reclaim locked SOL — safely, in seconds
        </span>
        <span className="eyebrow mx-auto mb-3 justify-center">
          <span className="index">01</span>
          GetBackSOL
        </span>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Your SOL is Trapped.
          <br />
          <span className="text-[var(--accent)]">Refund it.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--muted)] sm:text-base">
          Every token purchase on Solana locks 0.00204 SOL in rent fees. Even after selling, that
          SOL stays trapped in empty token accounts. Get your SOL back — we close them safely and
          instantly.
        </p>

        <p className="mx-auto mt-8 max-w-2xl text-xs text-[var(--muted)]">
          Live amounts pulled from your wallet — a standard account returns ~
          {RENT_PER_ACCOUNT.toFixed(6)} SOL.
        </p>
        <Card className="mx-auto mt-3 max-w-2xl !p-0 overflow-hidden text-left">
          {connected && (
            <div className="flex border-b border-[var(--border)]">
              <button
                onClick={() => setView("close")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  view === "close"
                    ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Closable accounts
              </button>
              <button
                onClick={() => setView("portfolio")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  view === "portfolio"
                    ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Full portfolio
              </button>
            </div>
          )}
          {!connected ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setWalletModalVisible(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setWalletModalVisible(true);
                }
              }}
              className="surface-hover flex w-full cursor-pointer flex-col items-center gap-3 px-5 py-16 text-center"
            >
              <Wallet className="h-6 w-6 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">
                Connect your wallet to scan for reclaimable accounts.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {SUPPORTED_WALLETS.map((name) => (
                  <span key={name} className="pill">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Any Solana Wallet Standard wallet works, not just these.
              </p>
              {isMobile && wallets.length === 0 && (
                <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-[var(--muted)]">No wallet browser detected —</span>
                  <div className="flex gap-2">
                    <a href={mobileWalletLinks.phantom} className="btn-outline px-3 py-1.5 text-xs">
                      Open in Phantom
                    </a>
                    <a href={mobileWalletLinks.solflare} className="btn-outline px-3 py-1.5 text-xs">
                      Open in Solflare
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : view === "portfolio" ? (
            <div className="px-5 py-4">
              {portfolio.loading ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
                  <p className="text-sm text-[var(--muted)]">Loading your portfolio…</p>
                </div>
              ) : portfolio.error ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                  <p className="text-sm text-[var(--muted)]">{portfolio.error}</p>
                  <button className="btn-outline" onClick={() => portfolio.refresh()}>
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-[8px] bg-[var(--surface-2)] px-4 py-3">
                    <span className="text-sm text-[var(--muted)]">Total portfolio value</span>
                    <span className="text-lg font-semibold">
                      {portfolio.totalUsdValue != null
                        ? `$${portfolio.totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    <div className="flex items-center justify-between py-2.5">
                      <span className="font-medium">SOL</span>
                      <div className="text-right">
                        <div className="text-sm">{portfolio.solBalance.toFixed(4)} SOL</div>
                        {portfolio.solPrice != null && (
                          <div className="text-xs text-[var(--muted)]">
                            ${(portfolio.solBalance * portfolio.solPrice).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    {sortedHoldings.map((h) => (
                      <div key={h.mint} className="flex items-center justify-between py-2.5">
                        <div>
                          <span className="font-medium">{h.symbol ?? "Unknown"}</span>
                          <span className="ml-2 font-mono text-xs text-[var(--muted)]">
                            {shortenAddress(h.mint)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            {h.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                          {h.usdValue != null && (
                            <div className="text-xs text-[var(--muted)]">${h.usdValue.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {sortedHoldings.length === 0 && (
                      <p className="py-6 text-center text-sm text-[var(--muted)]">
                        No other tokens held besides SOL.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">Scanning your wallet for dormant accounts…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <p className="text-sm text-[var(--muted)]">{error}</p>
              <button className="btn-outline" onClick={() => refresh()}>
                Try again
              </button>
            </div>
          ) : accounts.length === 0 && dustAccounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
              <PartyPopper className="h-6 w-6 text-[var(--accent)]" />
              <p className="text-sm text-[var(--muted)]">
                No closable accounts found — this wallet is already clean.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Select all ({closableAccounts.length} closable accounts found)
                </label>
                <span className="text-xs text-[var(--muted)]">{accountLabel(count)} selected</span>
              </div>

              {/* Desktop / tablet: table */}
              <table className="hidden w-full text-left text-sm sm:table">
                <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="w-10 px-5 py-2.5"></th>
                    <th className="px-2 py-2.5">Token</th>
                    <th className="px-5 py-2.5 text-right">Reclaimable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {displayAccounts.map((a) => {
                    const locked = a.needsBurn && !safeBurn;
                    return (
                      <tr key={a.pubkey} className={`surface-hover ${locked ? "opacity-40" : ""}`}>
                        <td className="px-5 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(a.pubkey)}
                            disabled={locked}
                            onChange={() => toggleOne(a.pubkey)}
                            className="h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="font-medium">{a.symbol ?? "Unknown"}</span>
                          <span className="ml-2 font-mono text-xs text-[var(--muted)]">
                            {shortenAddress(a.mint)}
                          </span>
                          {a.needsBurn && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                              <Flame className="h-3 w-3" /> {locked ? "Needs Safe-Burn" : "Dust"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right text-[var(--muted)]">
                          {a.reclaimable.toFixed(6)} SOL
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: stacked rows, so the reclaimable amount is never clipped */}
              <div className="divide-y divide-[var(--border)] sm:hidden">
                {displayAccounts.map((a) => {
                  const locked = a.needsBurn && !safeBurn;
                  return (
                    <label
                      key={a.pubkey}
                      className={`surface-hover flex items-start gap-3 px-4 py-3 ${locked ? "opacity-40" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(a.pubkey)}
                        disabled={locked}
                        onChange={() => toggleOne(a.pubkey)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] disabled:cursor-not-allowed"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{a.symbol ?? "Unknown"}</span>
                          <span className="shrink-0 text-sm text-[var(--muted)]">
                            {a.reclaimable.toFixed(6)} SOL
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs text-[var(--muted)]">
                            {shortenAddress(a.mint)}
                          </span>
                          {a.needsBurn && (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--accent)]">
                              <Flame className="h-3 w-3" /> {locked ? "Needs Safe-Burn" : "Dust"}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="border-t border-[var(--border)] p-5">
                <Toggle
                  checked={safeBurn}
                  onChange={setSafeBurn}
                  label="Safe-Burn dust balances first"
                  hint="Burns worthless leftover token dust before closing, so more accounts qualify for a refund."
                />

                {safeBurn && (
                  <div className="mt-4">
                    <Toggle
                      checked={sellDust}
                      onChange={setSellDust}
                      label="Sell dust for SOL instead of burning"
                      hint="Tries to sell dust tokens via Jupiter first, keeping 100% of the proceeds — only works when a token has a real market and your wallet already holds wrapped SOL. Falls back to burning otherwise."
                    />
                  </div>
                )}

                <div className="mt-5 space-y-1.5 rounded-[8px] bg-[var(--surface-2)] px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Gross reclaimable ({count} accounts)</span>
                    <span>{gross.toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Service fee ({(RECLAIM_FEE_RATE * 100).toFixed(0)}%)</span>
                    <span>−{fee.toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-semibold">
                    <span>You receive</span>
                    <span>{net.toFixed(6)} SOL</span>
                  </div>
                </div>

                <button
                  className="btn-primary mt-5 w-full"
                  disabled={count === 0 || status === "pending"}
                  onClick={handleClose}
                >
                  {status === "pending" ? "Closing accounts…" : `Close ${accountLabel(count)} & Reclaim SOL`}
                </button>

                <TxStatusBanner
                  status={status}
                  message={message}
                  pendingText="Waiting for wallet approval, then confirming on-chain…"
                />
              </div>
            </>
          )}
        </Card>

        {connected && publicKey && (
          <div className="mx-auto mt-4 max-w-2xl">
            <AffiliateBanner address={publicKey.toBase58()} />
          </div>
        )}

        <div className="mx-auto mt-4 max-w-2xl">
          <ReclaimHistory />
        </div>

        <p className="pill mx-auto mt-8 inline-flex w-fit items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {IS_MAINNET
            ? "Live on Solana mainnet — non-custodial, externally audited"
            : "Devnet preview — non-custodial, no funds at risk"}
        </p>
        <ImpactStats />
      </section>

      {/* Weekly leaderboard */}
      <section id="weekly-leaderboard" className="scroll-mt-24 pb-16 sm:pb-20">
        <SectionTitle
          level="h2"
          index="02"
          eyebrow="Leaderboard"
          title="Compete for the weekly prize pool"
          description="Ranked by XP from closing accounts and referrals. Real SOL, split between the top 3 every week."
        />
        <div className="mx-auto max-w-2xl">
          <WeeklyLeaderboard currentWallet={publicKey?.toBase58()} />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 pb-16 sm:pb-20">
        <SectionTitle
          level="h2"
          index="03"
          eyebrow="How it works"
          title="Three steps, one transaction"
          description="No accounts, no sign-up — just your wallet."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="text-left">
              <span className="eyebrow mb-4">
                <span className="index">{`0${i + 1}`}</span>
              </span>
              <step.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-24 pb-16 sm:pb-20">
        <SectionTitle
          level="h2"
          index="04"
          eyebrow="Security"
          title="Built to be verifiable, not just trusted"
          description="No custody, no hidden steps — and we're upfront about what hasn't happened yet."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {SECURITY_POINTS.map((point) => (
            <Card key={point.title} className="text-left">
              <point.icon className="mb-4 h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold">{point.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{point.body}</p>
            </Card>
          ))}
        </div>
        <div className="mx-auto mt-4 max-w-2xl">
          <a
            href="https://github.com/imshrky/getbacksol"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <Code2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            Verify the code yourself on GitHub
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
        />
        <SectionTitle level="h2" index="05" eyebrow="FAQ" title="Questions you might have" />
        <div className="mx-auto max-w-2xl">
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="scroll-mt-24 pt-16 sm:pt-20">
        <SectionTitle
          level="h2"
          index="06"
          eyebrow="Roadmap"
          title="Where GetBackSOL is headed"
          description="What's already shipped, what we're building right now, and what's next."
        />

        <div className="mb-8 flex flex-col items-center gap-2 rounded-[10px] border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="flex items-center gap-3">
            <Rocket className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            <span>
              <span className="block text-base font-semibold">GetBackSOL token launch</span>
              <span className="block text-sm text-[var(--muted)]">Mark your calendar — it&apos;s coming soon.</span>
            </span>
          </span>
          <span className="text-2xl font-bold tracking-tight text-[var(--accent)]">Aug 1, 2026</span>
        </div>

        <span className="eyebrow mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Shipped
        </span>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHIPPED_ACHIEVEMENTS.map((item) => (
            <div
              key={item.text}
              className="flex flex-col gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium tracking-wide text-[var(--muted)]">
                {item.date}
              </span>
              <span className="text-sm leading-snug">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ROADMAP_COLUMNS.map((column) => (
            <Card key={column.status} className="text-left">
              <span className="eyebrow mb-4">
                <span className={`h-1.5 w-1.5 rounded-full ${column.dotClassName}`} />
                {column.status}
              </span>
              <ul className="flex flex-col gap-3">
                {column.items.map((item) => (
                  <li key={item.text}>
                    <span className="block text-xs font-medium tracking-wide text-[var(--muted)]">
                      {item.date}
                    </span>
                    <span className="text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
