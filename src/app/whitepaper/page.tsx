import type { Metadata } from "next";
import { SectionTitle } from "@/components/ui/Card";
import { DownloadPdfButton } from "@/components/ui/DownloadPdfButton";

const TITLE = "Whitepaper | GetBackSOL";
const DESCRIPTION =
  "How GetBackSOL reclaims locked SOL from dormant Solana accounts: the problem, the non-custodial architecture, the fee model, the Token Creator, and the $GBS token.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/whitepaper" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/whitepaper" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-lg font-semibold tracking-tight">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed text-[var(--muted)]">{children}</li>;
}

export default function WhitepaperPage() {
  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Whitepaper"
        title="GetBackSOL"
        description="Reclaim locked SOL from dormant Solana accounts, safely, transparently, non-custodially."
      />

      <div className="mx-auto mb-6 flex max-w-2xl justify-center">
        <DownloadPdfButton />
      </div>

      <article className="mx-auto max-w-2xl">
        <H2>1. Abstract</H2>
        <P>
          Every SPL token account on Solana holds a small rent-exempt deposit (~0.002 SOL) for as
          long as it exists. Over time, wallets accumulate dozens of dormant, empty token accounts,
          each locking a little SOL that most users never realize is recoverable. GetBackSOL is a
          non-custodial tool that scans a wallet, closes those dead accounts, and returns the locked
          SOL to the owner, in seconds, minus a service fee. It is live on Solana mainnet.
        </P>

        <H2>2. The problem</H2>
        <P>
          Creating a token account on Solana requires a rent-exempt deposit that stays locked until
          the account is closed. Airdrops, one-off swaps, and abandoned memecoins all leave accounts
          behind. The SOL isn&apos;t lost, but it&apos;s frozen, and reclaiming it manually means
          building and signing raw instructions, which is unforgiving for non-developers.
        </P>

        <H2>3. The solution</H2>
        <P>GetBackSOL turns that manual process into one guided flow:</P>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <LI>
            <b className="text-[var(--foreground)]">Reclaim Rent.</b> Connect a wallet, scan every
            token account, and close the empty ones in a single transaction. The released rent goes
            straight to the owner.
          </LI>
          <LI>
            <b className="text-[var(--foreground)]">Safe-Burn.</b> Accounts with leftover dust are
            burned first, in the same transaction, so they also qualify to close.
          </LI>
          <LI>
            <b className="text-[var(--foreground)]">Sell dust.</b> When a leftover token has real
            market value, it can be sold for SOL via Jupiter instead of burned.
          </LI>
          <LI>
            <b className="text-[var(--foreground)]">Gasless for empty wallets.</b> A wallet with no
            SOL for network fees can still reclaim. The platform fronts the tiny network fee, so
            there is no barrier to entry.
          </LI>
        </ul>

        <H2>4. Non-custodial architecture</H2>
        <P>
          Every transaction is built by the application but signed only by the user&apos;s wallet.
          GetBackSOL never holds private keys, seed phrases, or funds, and will never ask for them.
          The reclaimed SOL is released directly to the owner by the Token Program; the service fee
          moves in the same atomic transaction, so the exact net amount is known before signing.
          Closing an account that still holds value is impossible. It is enforced by the Solana
          network itself, not by a promise the app makes.
        </P>

        <H2>5. Verifiability</H2>
        <P>
          Trust is replaced with proof wherever possible: the source code is public on GitHub, the
          fee wallet&apos;s ownership is verified on Solscan, and every reclaim is recorded and
          independently checkable on any Solana block explorer.
        </P>

        <H2>6. Fee model</H2>
        <P>
          Scanning is free. A flat service fee applies only to SOL actually reclaimed, shown in full
          (gross, fee, net) before the user signs, and deducted in the same atomic transaction,
          nothing is charged afterward. Holders of the $GBS token receive a reduced fee.
        </P>

        <H2>7. Token Creator</H2>
        <P>
          Beyond reclaiming, GetBackSOL lets anyone launch their own Solana token with no code: name,
          symbol, supply, decimals and logo, with on-chain Metaplex metadata so the token appears
          with its name and image in wallets. Freeze and mint authorities can be revoked in the same
          transaction. Adding liquidity on Raydium then makes the token tradeable, and it is listed
          on Jupiter automatically once a pool exists.
        </P>

        <H2>8. The $GBS token</H2>
        <P>
          $GBS is planned as a utility token, not a revenue-share instrument. The intended core
          utility is a reduced platform fee for holders, alongside community access and governance
          over time. The details below are the launch plan and may be adjusted before release.
        </P>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <LI>Fixed supply, mint authority revoked at launch.</LI>
          <LI>An allocation airdropped to existing users, weighted by on-chain activity.</LI>
          <LI>Liquidity paired with SOL, with the LP locked.</LI>
          <LI>Team allocation vested; all key wallet addresses published for verification.</LI>
        </ul>

        <H2>9. Ecosystem</H2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <LI>
            <b className="text-[var(--foreground)]">Partner program & affiliates.</b> Integrators and
            any connected wallet earn a share of the fee on every reclaim they refer.
          </LI>
          <LI>
            <b className="text-[var(--foreground)]">Weekly leaderboard.</b> A recurring competition
            with a prize pool funded by a share of real platform activity.
          </LI>
          <LI>
            <b className="text-[var(--foreground)]">Community.</b> A Discord server, a Telegram bot
            that checks any wallet, and anti-scam verification for members.
          </LI>
        </ul>

        <H2>10. Roadmap</H2>
        <P>
          Live today: Reclaim Rent, Safe-Burn, Sell, gasless reclaims, the Token Creator, the partner
          and affiliate programs, the weekly leaderboard, and the community tooling. Planned: the
          $GBS token launch, native in-app liquidity pool creation with automatic Jupiter listing,
          migrating the fee wallet to a multisig, and bringing the remaining tools to mainnet.
        </P>

        <H2>Disclaimer</H2>
        <P>
          This document is informational and does not constitute financial, investment, or legal
          advice, nor an offer or solicitation to buy any asset. GetBackSOL is non-custodial and has
          not undergone an external security audit; use it at your own risk. Cryptocurrency involves
          risk, and forward-looking plans (including the $GBS token) may change.
        </P>
      </article>
    </div>
  );
}
