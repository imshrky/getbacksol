import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeProvider from "@/components/ThemeProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const SITE_NAME = "GetBackSOL";
const SITE_TITLE = "GetBackSOL | Reclaim locked SOL from dormant Solana accounts";
const SITE_DESCRIPTION =
  "Scan your Solana wallet, close dormant token accounts, and get the locked SOL rent back — in seconds, minus a small service fee.";

export const metadata: Metadata = {
  metadataBase: new URL("https://getbacksol.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Solana rent reclaim",
    "reclaim SOL",
    "close token accounts",
    "dormant token accounts",
    "SPL token rent refund",
    "Solana wallet cleanup",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  verification: {
    google: "aNEWQV-blfW8koixrZjPY3D5FcXysIiQW6fWXYPXuAw",
  },
};

// Runs before hydration to avoid a flash of the wrong theme.
const noFlashScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored && stored !== 'system') ? stored : (systemDark ? 'dark' : 'light');
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
    <html lang="en" className={poppins.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <Providers>
            <Header />
            <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">{children}</main>
            <Footer />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
