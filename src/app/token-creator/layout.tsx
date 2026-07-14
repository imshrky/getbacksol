import type { Metadata } from "next";

// The page itself is a Client Component, which can't export `metadata`
// directly — see partners/layout.tsx for the full explanation. Without this,
// /token-creator silently inherited the homepage's title/description/canonical.
const TITLE = "Token Creator | GetBackSOL";
const DESCRIPTION =
  "Create your own Solana SPL token with a guided, no-code flow — ready in minutes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/token-creator" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/token-creator" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function TokenCreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
