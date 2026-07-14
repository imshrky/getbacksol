import type { Metadata } from "next";

// See partners/layout.tsx: this page is a Client Component and can't export
// `metadata` directly, so without this it silently inherited the homepage's.
const TITLE = "Leaderboard | GetBackSOL";
const DESCRIPTION = "Top burners on GetBackSOL, ranked by total value burned across all tokens.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/leaderboard" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/leaderboard" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
