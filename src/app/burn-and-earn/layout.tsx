import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Burn & Earn | GetBackSOL";
const DESCRIPTION =
  "Burn tokens to reduce supply and earn points toward the leaderboard and future reward drops.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/burn-and-earn" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/burn-and-earn" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function BurnAndEarnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
