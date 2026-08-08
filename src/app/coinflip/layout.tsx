import type { Metadata } from "next";

// Same pattern as create-liquidity/layout.tsx: this page is a Client
// Component and can't export `metadata` directly.
const TITLE = "Coinflip | GetBackSOL";
const DESCRIPTION = "A real-money coin flip game. Wager SOL, double it or lose it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/coinflip" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/coinflip" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  // Deliberately not indexed: this is real-money gambling, and gambling
  // content has real regulatory/jurisdictional implications for search
  // visibility that the rest of the site's SEO work doesn't need to
  // account for. Revisit once legal compliance for target jurisdictions
  // has actually been reviewed — see CLAUDE.md.
  robots: { index: false, follow: true },
};

export default function CoinflipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
