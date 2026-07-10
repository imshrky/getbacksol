"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import ThemeToggle from "./ThemeToggle";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const NAV_LINKS = [
  { href: "/", label: "Token Creator" },
  { href: "/create-liquidity", label: "Liquidity" },
  { href: "/swap", label: "Swap" },
  { href: "/remove-liquidity", label: "Remove Liquidity" },
  { href: "/burn-token", label: "Burn" },
  { href: "/burn-and-earn", label: "Burn & Earn" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/reclaim-rent", label: "Reclaim Rent" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[var(--accent)] text-[13px] font-bold text-[var(--accent-ink)]">
            N
          </span>
          <span className="text-sm font-semibold tracking-tight">
            NEBULA<span className="text-[var(--muted)] font-normal"> / TOOLS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "border-b-2 px-3 py-2 text-[13px] font-medium tracking-tight transition-colors",
                pathname === link.href
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">
            <WalletMultiButtonDynamic />
          </div>
          <button
            className="rounded-[4px] border border-[var(--border-strong)] p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "rounded-[4px] px-3 py-2 text-sm",
                pathname === link.href
                  ? "bg-[var(--hover)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <WalletMultiButtonDynamic />
          </div>
        </nav>
      )}
    </header>
  );
}
