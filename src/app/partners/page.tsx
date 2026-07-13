"use client";

import { useState } from "react";
import { Handshake, KeyRound, Copy, Check, ShieldCheck, LineChart, Link2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Faq } from "@/components/ui/Faq";

const FAQ_ITEMS = [
  {
    q: "How do I actually integrate this?",
    a: "Call GET /api/v1/scan?wallet=<address> with your API key in the X-API-Key header to show a user how much SOL they can reclaim in your own UI. When they want to act on it, link them to getbacksol.com/?ref=<your-partner-id> — they connect their own wallet and close accounts through our existing gasless relay. You never touch a private key or build a transaction yourself.",
  },
  {
    q: "How do you calculate my share?",
    a: "We charge a 15% fee on every reclaim, taken in the same atomic transaction as the close. When that transaction was referred by your link, we credit your account with 30% of that fee — computed from the actual on-chain transfer amount, not from anything your side reports.",
  },
  {
    q: "How and when do I get paid?",
    a: "Payouts are handled manually for now (there's no live partner program yet, so no automated payout run exists). Reach out on Telegram once you have real referral volume and we'll settle it directly to your payout wallet.",
  },
  {
    q: "Can my key move funds or sign transactions?",
    a: "No. Your API key only grants read-only wallet scanning. It can never build, sign, or submit a transaction — every reclaim is still signed by the end user's own wallet and executed through our unchanged, allow-listed relay.",
  },
  {
    q: "Is there a cost to join?",
    a: "No. Signup is free and instant — you get a key immediately after submitting the form below.",
  },
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function PartnersPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [payoutWallet, setPayoutWallet] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ partnerId: string; apiKey: string; revenueShare: number } | null>(
    null
  );
  const [copied, setCopied] = useState<"key" | "link" | null>(null);

  const canSubmit = name.trim().length > 1 && email.trim().length > 3 && payoutWallet.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || state === "submitting") return;

    setState("submitting");
    setError("");

    try {
      const res = await fetch("/api/partners/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, website, payoutWallet }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Signup failed.");
      }
      setResult(body);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed.");
      setState("error");
    }
  }

  function copy(text: string, which: "key" | "link") {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Partner Program"
        title="Earn a share of every SOL you help reclaim"
        description="Show your users the SOL trapped in their own wallets, send them our way to reclaim it, and keep 30% of the fee — automatically attributed to you, no manual reporting."
      />

      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        <Card>
          <Link2 className="mb-4 h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">Read-only integration</h3>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Your key only calls our scan endpoint. Execution happens on getbacksol.com, signed by
            the user&apos;s own wallet — your integration never touches funds.
          </p>
        </Card>
        <Card>
          <LineChart className="mb-4 h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">30% revenue share</h3>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Every referred reclaim credits your account with 30% of our 15% fee, calculated from
            the real, confirmed transaction — not self-reported.
          </p>
        </Card>
        <Card>
          <ShieldCheck className="mb-4 h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">Non-custodial, always</h3>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Same security model as the rest of GetBackSOL: we never see, store, or touch a
            private key — yours or your users&apos;.
          </p>
        </Card>
      </div>

      <Card className="mx-auto mt-8 max-w-2xl">
        {state === "success" && result ? (
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <Check className="h-4 w-4" />
              You&apos;re in — partner ID: {result.partnerId}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Save your API key now — for your security, we only store its hash, so this is the
              only time it will ever be shown.
            </p>

            <label className="mb-1.5 mt-5 block text-xs font-medium text-[var(--muted)]">
              API key
            </label>
            <div className="flex items-center gap-2">
              <code className="field-input flex-1 overflow-x-auto whitespace-nowrap text-xs">
                {result.apiKey}
              </code>
              <button
                type="button"
                onClick={() => copy(result.apiKey, "key")}
                className="btn-outline flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs"
              >
                {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "key" ? "Copied" : "Copy"}
              </button>
            </div>

            <label className="mb-1.5 mt-5 block text-xs font-medium text-[var(--muted)]">
              Your referral link
            </label>
            <div className="flex items-center gap-2">
              <code className="field-input flex-1 overflow-x-auto whitespace-nowrap text-xs">
                {`https://getbacksol.com/?ref=${result.partnerId}`}
              </code>
              <button
                type="button"
                onClick={() => copy(`https://getbacksol.com/?ref=${result.partnerId}`, "link")}
                className="btn-outline flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs"
              >
                {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-5 text-xs text-[var(--muted)]">
              Use the API key with <code>X-API-Key</code> against{" "}
              <code>GET /api/v1/scan?wallet=&lt;address&gt;</code>, and send users ready to reclaim
              to your referral link above.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold">Get your API key</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                  Name or company
                </label>
                <input
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Wallet"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Email</label>
                <input
                  type="email"
                  className="field-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                  Website (optional)
                </label>
                <input
                  className="field-input"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                  Payout wallet (Solana address)
                </label>
                <input
                  className="field-input"
                  value={payoutWallet}
                  onChange={(e) => setPayoutWallet(e.target.value)}
                  placeholder="Your Solana address"
                  maxLength={64}
                />
              </div>
            </div>

            {state === "error" && (
              <p className="mt-4 text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || state === "submitting"}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              {state === "submitting" ? "Creating your key…" : "Create my API key"}
            </button>
          </form>
        )}
      </Card>

      <div className="mx-auto mt-12 max-w-2xl">
        <span className="eyebrow mb-4">Frequently asked</span>
        <Faq items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
