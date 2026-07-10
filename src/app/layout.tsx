import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import ThemeProvider from "@/components/ThemeProvider";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "GetBackSOL | Reclaim locked SOL from dormant Solana accounts",
  description:
    "Scan your Solana wallet, close dormant token accounts, and get the locked SOL rent back — in seconds, minus a small service fee.",
};

// Runs before hydration to avoid a flash of the wrong theme.
const noFlashScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <Providers>
            <Header />
            <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">{children}</main>
            <footer className="rule mt-10 py-8 text-center text-xs text-[var(--muted)]">
              GetBackSOL is currently a UI mockup — no real transactions are executed until
              on-chain integration is completed. Additional Solana tools (Token Creator, Swap,
              Liquidity...) are included as a preview of the wider product roadmap.
            </footer>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
