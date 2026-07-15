import type { Metadata } from "next";
import { SectionTitle } from "@/components/ui/Card";

const TITLE = "Privacy Policy | GetBackSOL";
const DESCRIPTION =
  "What GetBackSOL collects, what it never asks for, and how wallet and partner data is used.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/privacy" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: true },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 text-sm leading-relaxed text-[var(--muted)]">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="my-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted)]">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <SectionTitle
        eyebrow="Legal"
        title="Privacy Policy"
        description="Last updated July 2026."
      />

      <P>
        GetBackSOL is a non-custodial tool — most of what it does never touches personal data at
        all, because a Solana wallet address is public blockchain information, not something we
        collect about you. This page explains the few places where that isn&apos;t true.
      </P>

      <H2>What we collect</H2>
      <Ul>
        <li>
          <b>Wallet addresses and transaction data.</b> When you connect a wallet, we read its
          public address and token account balances to determine what&apos;s reclaimable. Every
          confirmed reclaim (wallet, amount, transaction signature) is stored so it can be shown in
          the public reclaim history and weekly leaderboard — the same information anyone could
          already look up on Solscan.
        </li>
        <li>
          <b>Partner program details.</b> If you sign up at{" "}
          <a href="/partners" className="text-[var(--accent)] hover:underline">
            /partners
          </a>
          , we store your name, email, optional website, and payout wallet address, plus the IP
          address of the signup request — used only to enforce a daily signup limit and prevent
          abuse.
        </li>
        <li>
          <b>Local browser storage.</b> Your theme preference (light/dark) is saved in your
          browser&apos;s <code>localStorage</code>. If you arrive via a referral link, the referral
          tag is saved in <code>sessionStorage</code> until you complete a reclaim. Neither leaves
          your browser or is sent to a third party.
        </li>
      </Ul>

      <H2>What we never collect</H2>
      <Ul>
        <li>
          Your private key or seed phrase — ever, under any circumstance. Every transaction is
          built by GetBackSOL but signed only by your own wallet.
        </li>
        <li>Your name, physical address, or other personal identifiers, unless you volunteer them (e.g. the partner signup form or a support message).</li>
      </Ul>

      <H2>Cookies and tracking</H2>
      <P>
        We don&apos;t use tracking cookies, and we don&apos;t run any third-party analytics or
        advertising scripts. The only client-side storage is the local/session storage described
        above.
      </P>

      <H2>Third parties involved in using GetBackSOL</H2>
      <Ul>
        <li>Our RPC provider and the Solana network itself process any transaction you submit — inherent to using any Solana application, not specific to us.</li>
        <li>Jupiter&apos;s swap infrastructure is used only if you opt in to &quot;Sell dust for SOL.&quot;</li>
        <li>Our hosting provider (Vercel) and database provider (Neon) may log standard technical data (like IP addresses) as part of normal infrastructure operation, outside our direct control.</li>
      </Ul>

      <H2>Data retention and deletion</H2>
      <P>
        Partner account data is kept while the account is active; contact us to request deletion.
        On-chain data — wallet addresses, transaction signatures, amounts — is permanently recorded
        on the Solana blockchain itself and can&apos;t be deleted regardless of what happens to our
        own database.
      </P>

      <H2>Your rights</H2>
      <P>
        Depending on where you live, you may have rights to access, correct, or delete personal
        data we hold about you (this applies to partner account details, not on-chain data — see
        above). Reach us on{" "}
        <a href="https://telegram.me/GetBackSOL" className="text-[var(--accent)] hover:underline">
          Telegram
        </a>{" "}
        to make a request.
      </P>

      <H2>Changes to this policy</H2>
      <P>We&apos;ll update this page if our practices change, and update the date at the top when we do.</P>

      <H2>Contact</H2>
      <P>
        Questions about this policy: reach us on{" "}
        <a href="https://telegram.me/GetBackSOL" className="text-[var(--accent)] hover:underline">
          Telegram
        </a>
        .
      </P>
    </div>
  );
}
