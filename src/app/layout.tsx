import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import ThemeProvider from "@/components/ThemeProvider";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Nebula Tools | Solana Token & Liquidity Suite",
  description:
    "Create SPL tokens, manage liquidity, swap, burn, and track the leaderboard — all in one no-code Solana toolkit.",
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
              Nebula Tools is a UI mockup inspired by Solana token-creation platforms. No real
              transactions are executed until on-chain integration is completed. Not affiliated
              with Orion Tools.
            </footer>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
