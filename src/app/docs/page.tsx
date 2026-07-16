import type { Metadata } from "next";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/Card";

const TITLE = "API Documentation | GetBackSOL";
const DESCRIPTION =
  "How to integrate the GetBackSOL Partner API: authentication, the scan endpoint, rate limits, and the 60% revenue share.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/docs" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 text-sm leading-relaxed text-[var(--muted)]">{children}</p>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <SectionTitle
        eyebrow="For developers"
        title="Partner API documentation"
        description="A read-only wallet scan you can drop into your own product — no transaction building, no signing, no custody, ever."
      />

      <H2>Overview</H2>
      <P>
        The Partner API lets you show your own users how much SOL they can reclaim from dormant
        Solana token accounts, directly in your UI. It answers one question — &quot;what&apos;s in
        this wallet?&quot; — and nothing else. Building or submitting a transaction, and holding a
        private key, are never part of what an API key can do; that always happens on
        getbacksol.com, signed by the user&apos;s own wallet.
      </P>

      <H2>Getting an API key</H2>
      <P>
        Self-service, free, instant — no manual approval. Sign up at{" "}
        <Link href="/partners" className="text-[var(--accent)] hover:underline">
          getbacksol.com/partners
        </Link>{" "}
        and you&apos;ll get a key immediately. We only store its SHA-256 hash, so save it somewhere
        safe the moment you see it — it can&apos;t be recovered afterward, only reissued.
      </P>

      <H2>Authentication</H2>
      <P>
        Send your key in the <code>X-API-Key</code> header on every request.
      </P>
      <Code>{`X-API-Key: gbs_live_yourkeyhere`}</Code>

      <H2>Rate limits</H2>
      <P>
        30 requests per minute per key, tracked in a fixed one-minute window. Generous for a real
        product UI; a 429 response means you&apos;ve hit it — back off and retry after the current
        minute rolls over.
      </P>

      <H2>Endpoint: scan a wallet</H2>
      <Code>{`GET https://getbacksol.com/api/v1/scan?wallet=<address>`}</Code>
      <P>
        <code>wallet</code> is any Solana wallet address, as a query parameter. Read-only: this
        endpoint never touches a private key and can&apos;t build or submit anything.
      </P>

      <H2>Example request</H2>
      <Code>{`curl "https://getbacksol.com/api/v1/scan?wallet=6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1" \\
  -H "X-API-Key: gbs_live_yourkeyhere"`}</Code>

      <Code>{`// JavaScript
const res = await fetch(
  "https://getbacksol.com/api/v1/scan?wallet=" + wallet,
  { headers: { "X-API-Key": apiKey } }
);
const data = await res.json();`}</Code>

      <Code>{`# Python
import requests

res = requests.get(
    "https://getbacksol.com/api/v1/scan",
    params={"wallet": wallet},
    headers={"X-API-Key": api_key},
)
data = res.json()`}</Code>

      <H2>Example response</H2>
      <Code>{`{
  "wallet": "6mBmVBchk7UnW1FdfN3bm6KKTV376UxuZ3je7sEzjpd1",
  "network": "mainnet-beta",
  "feeRate": 0.15,
  "closable": {
    "count": 2,
    "grossReclaimable": 0.004079,
    "netReclaimable": 0.003467,
    "accounts": [
      { "pubkey": "...", "mint": "...", "programId": "...", "reclaimable": 0.00204 }
    ]
  },
  "dust": {
    "count": 1,
    "accounts": [
      { "pubkey": "...", "mint": "...", "programId": "...", "reclaimable": 0.00204, "needsBurn": true, "rawAmount": "1250" }
    ]
  }
}`}</Code>
      <P>
        <code>closable</code> accounts have a zero token balance and can be closed right away.{" "}
        <code>dust</code> accounts still hold a small residual balance and need Safe-Burn (or a
        sell route) before they can close — <code>grossReclaimable</code>/
        <code>netReclaimable</code> only cover the <code>closable</code> set, since dust
        can&apos;t be reclaimed until it&apos;s dealt with first.
      </P>

      <H2>Error responses</H2>
      <Code>{`401  Invalid or missing X-API-Key.
429  Rate limit exceeded. Try again in a minute.
400  Missing or invalid 'wallet' query parameter.
503  Scan is temporarily unavailable.`}</Code>

      <H2>Sending users to actually reclaim</H2>
      <P>
        The scan is informational only. When a user wants to act on it, link them to{" "}
        <code>getbacksol.com/?ref=&lt;your-partner-id&gt;</code>. They connect their own wallet
        there and sign the close/burn transaction directly with us — your integration is never in
        that path.
      </P>

      <H2>Revenue share: 60%</H2>
      <P>
        Every reclaim referred through your <code>?ref=</code> link credits your account with{" "}
        <b>60% of our 15% service fee</b> — calculated from the real, confirmed on-chain transfer
        amount at the moment the transaction lands, never from a number your integration reports.
        Check your running total at any time:
      </P>
      <Code>{`GET https://getbacksol.com/api/affiliate/stats?wallet=<your-partner-id>`}</Code>

      <div className="mt-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <p className="text-sm text-[var(--muted)]">
          Ready to get a key?{" "}
          <Link href="/partners" className="font-medium text-[var(--accent)] hover:underline">
            Sign up at /partners
          </Link>{" "}
          — free, instant, no approval process.
        </p>
      </div>
    </div>
  );
}
