import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Create Liquidity | GetBackSOL";
const DESCRIPTION =
  "Pair your token with SOL (or another asset) so people can trade it on Solana.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/create-liquidity" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/create-liquidity" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function CreateLiquidityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
