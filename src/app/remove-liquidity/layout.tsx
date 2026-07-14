import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Remove Liquidity | GetBackSOL";
const DESCRIPTION = "Withdraw your share of a Solana liquidity pool back into both underlying tokens.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/remove-liquidity" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/remove-liquidity" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RemoveLiquidityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
