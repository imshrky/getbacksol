import type { Metadata } from "next";

// See partners/layout.tsx for why a Client Component page needs a sibling
// Server Component layout to carry metadata. This page is unlisted (not in
// Header nav) and noindex — it's an operational tool, not a public page.
export const metadata: Metadata = {
  title: "Admin — Leaderboard payout | GetBackSOL",
  robots: { index: false, follow: false },
};

export default function AdminLeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
