import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Burn Token | GetBackSOL";
const DESCRIPTION = "Permanently remove Solana tokens from circulating supply.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/burn-token" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/burn-token" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function BurnTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
