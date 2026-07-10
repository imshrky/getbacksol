"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Wallet,
  ScanSearch,
  Coins,
  ShieldCheck,
  Lock,
  Eye,
  ShieldAlert,
  Code2,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { TxStatusBanner } from "@/components/ui/TxStatusBanner";
import { Faq } from "@/components/ui/Faq";
import { ImpactStats } from "@/components/ui/ImpactStats";
import { useSimulatedTx } from "@/lib/useSimulatedTx";
import { MOCK_RENT_ACCOUNTS, RECLAIM_FEE_RATE, RENT_PER_ACCOUNT } from "@/lib/mockTokens";

function accountLabel(count: number) {
  return `${count} account${count === 1 ? "" : "s"}`;
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
    body: "We list every token account you own and flag the ones sitting at a zero (or dust) balance.",
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
    icon: ShieldAlert,
    title: "Not yet audited",
    body: "GetBackSOL is currently a devnet preview and hasn't had an external security audit. We won't move real funds on mainnet until that review is done.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What is this locked SOL, exactly?",
    a: "Every SPL token account you own — even ones for tokens you no longer hold — locks a small rent-exempt deposit (~0.00204 SOL) to stay on the Solana ledger. Closing an empty account releases that deposit back to you.",
  },
  {
    q: "Is closing an account safe?",
    a: "Yes. The Token Program only allows closing accounts with a zero balance, so it's physically impossible to close an account that still holds value. Accounts with worthless dust are burned first (optional) so they qualify too.",
  },
  {
    q: "Why a 15% fee?",
    a: "The service fee covers RPC infrastructure and keeps the tool running. It's calculated on the amount reclaimed and sent in the same atomic transaction — you always see the exact net amount before confirming.",
  },
  {
    q: "Is GetBackSOL custodial?",
    a: "No. We never hold your keys or your funds. Every transaction is built by the app but signed only by your wallet, and SOL is sent directly to your address.",
  },
  {
    q: "Is this live on mainnet?",
    a: "GetBackSOL is currently in devnet testing ahead of a mainnet launch. Connect a devnet wallet to try the full flow — nothing here touches real funds yet.",
  },
];

export default function HomePage() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(MOCK_RENT_ACCOUNTS.map((a) => a.id))
  );
  const [safeBurn, setSafeBurn] = useState(true);
  const { status, message, run } = useSimulatedTx();

  const allSelected = selected.size === MOCK_RENT_ACCOUNTS.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(MOCK_RENT_ACCOUNTS.map((a) => a.id)));
  }

  const { gross, fee, net, count } = useMemo(() => {
    const chosen = MOCK_RENT_ACCOUNTS.filter((a) => selected.has(a.id));
    const grossVal = chosen.reduce((sum, a) => sum + a.reclaimable, 0);
    const feeVal = grossVal * RECLAIM_FEE_RATE;
    return { gross: grossVal, fee: feeVal, net: grossVal - feeVal, count: chosen.length };
  }, [selected]);

  return (
    <div className="fade-in">
      {/* Hero */}
      <section className="pb-16 pt-6 text-center sm:pb-20">
        <span className="eyebrow mx-auto mb-3 justify-center">
          <span className="index">01</span>
          GetBackSOL
        </span>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Get back the SOL trapped in your dormant accounts
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--muted)] sm:text-base">
          Every empty token account in your wallet is holding a small SOL deposit hostage. Scan
          your wallet, close them in one transaction, and reclaim what's yours — minus a small
          service fee.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="#reclaim" className="btn-primary">
            Scan my wallet
          </Link>
          <Link href="#how-it-works" className="btn-outline">
            How it works
          </Link>
        </div>
        <p className="pill mx-auto mt-8 inline-flex w-fit items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Devnet preview — non-custodial, no funds at risk
        </p>
        <ImpactStats />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 pb-16 sm:pb-20">
        <SectionTitle
          index="02"
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
          index="03"
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
            href="#"
            className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <Code2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            Verify the code yourself — source link coming soon
          </a>
        </div>
      </section>

      {/* The tool */}
      <section id="reclaim" className="scroll-mt-24 pb-16 sm:pb-20">
        <SectionTitle
          index="04"
          eyebrow="Reclaim Rent"
          title="Close dead accounts, reclaim SOL"
          description={`Standard rent-exempt reserve per account: ~${RENT_PER_ACCOUNT.toFixed(6)} SOL.`}
        />

        <Card className="mx-auto max-w-2xl !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Select all ({MOCK_RENT_ACCOUNTS.length} closable accounts found)
            </label>
            <span className="text-xs text-[var(--muted)]">{accountLabel(count)} selected</span>
          </div>

          {/* Desktop / tablet: table */}
          <table className="hidden w-full text-left text-sm sm:table">
            <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="w-10 px-5 py-2.5"></th>
                <th className="px-2 py-2.5">Token account</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Reclaimable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_RENT_ACCOUNTS.map((a) => (
                <tr key={a.id} className="surface-hover">
                  <td className="px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="font-medium">{a.symbol}</span>
                    <span className="ml-2 font-mono text-xs text-[var(--muted)]">{a.mint}</span>
                  </td>
                  <td className="px-2 py-2.5 text-xs">
                    {a.status === "empty" ? (
                      <span className="text-[var(--muted)]">Empty</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--accent)]">
                        <Flame className="h-3 w-3" /> Dust · {a.dustAmount}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[var(--muted)]">
                    {a.reclaimable.toFixed(6)} SOL
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: stacked rows, so the reclaimable amount is never clipped */}
          <div className="divide-y divide-[var(--border)] sm:hidden">
            {MOCK_RENT_ACCOUNTS.map((a) => (
              <label
                key={a.id}
                className="surface-hover flex items-start gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggleOne(a.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.symbol}</span>
                    <span className="shrink-0 text-sm text-[var(--muted)]">
                      {a.reclaimable.toFixed(6)} SOL
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-[var(--muted)]">{a.mint}</span>
                    {a.status === "empty" ? (
                      <span className="shrink-0 text-xs text-[var(--muted)]">Empty</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--accent)]">
                        <Flame className="h-3 w-3" /> Dust
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="border-t border-[var(--border)] p-5">
            <Toggle
              checked={safeBurn}
              onChange={setSafeBurn}
              label="Safe-Burn + Sell dust balances first"
              hint="Burns worthless leftover token dust before closing, so more accounts qualify for a refund."
            />

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
              onClick={() =>
                run(`Closed ${count} account${count > 1 ? "s" : ""} — ${net.toFixed(6)} SOL sent to your wallet.`)
              }
            >
              {status === "pending" ? "Closing accounts…" : `Close ${accountLabel(count)} & Reclaim SOL`}
            </button>

            <TxStatusBanner status={status} message={message} />
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24">
        <SectionTitle index="05" eyebrow="FAQ" title="Questions you might have" />
        <div className="mx-auto max-w-2xl">
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>
    </div>
  );
}
