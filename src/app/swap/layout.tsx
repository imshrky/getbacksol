import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Swap | GetBackSOL";
const DESCRIPTION = "Trade between SPL tokens on Solana at the best available route.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/swap" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/swap" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
