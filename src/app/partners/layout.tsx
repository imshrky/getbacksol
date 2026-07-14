import type { Metadata } from "next";

// The page itself is a Client Component (it has interactive form state),
// which can't export `metadata` directly — Next.js only reads that export
// from Server Components. Without this layout, /partners silently
// inherited the root layout's homepage title and description verbatim, a
// duplicate-title issue.
const TITLE = "Partner Program | GetBackSOL";
const DESCRIPTION =
  "Earn 30% of the fee on every SOL you help reclaim. Instant, self-service API key — read-only wallet scanning, non-custodial the whole way through.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/partners" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/partners",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
