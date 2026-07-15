import type { Metadata } from "next";
import { SectionTitle } from "@/components/ui/Card";

const TITLE = "Copyright | GetBackSOL";
const DESCRIPTION = "Copyright notice for the GetBackSOL name, brand, and codebase.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/copyright" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/copyright" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: true },
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 text-sm leading-relaxed text-[var(--muted)]">{children}</p>;
}

export default function CopyrightPage() {
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <SectionTitle eyebrow="Legal" title="Copyright" description="Last updated July 2026." />

      <P>© 2026 GetBackSOL. All rights reserved.</P>

      <P>
        The GetBackSOL name, logo, and website design are the property of GetBackSOL and may not be
        reproduced without permission.
      </P>

      <P>
        The application&apos;s source code is publicly viewable on{" "}
        <a
          href="https://github.com/imshrky/getbacksol"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          GitHub
        </a>{" "}
        so anyone can independently verify what it does before connecting a wallet — that
        transparency doesn&apos;t grant a license to copy, redistribute, or reuse the code or brand
        elsewhere.
      </P>

      <P>
        If you believe any content on this site infringes your copyright, contact us on{" "}
        <a href="https://telegram.me/GetBackSOL" className="text-[var(--accent)] hover:underline">
          Telegram
        </a>{" "}
        with details and we&apos;ll look into it.
      </P>
    </div>
  );
}
