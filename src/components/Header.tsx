"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { LogoMark } from "./ui/Logo";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

// Hash links point through "/" so they navigate home first when clicked from
// another route (e.g. /blog) instead of trying to scroll to an id that only
// exists on the homepage.
const NAV_LINKS = [
  { href: "/#how-it-works", section: "how-it-works", label: "How it works" },
  { href: "/#security", section: "security", label: "Security" },
  { href: "/#reclaim", section: "reclaim", label: "Reclaim SOL" },
  { href: "/#faq", section: "faq", label: "FAQ" },
  { href: "/blog", section: null, label: "Blog" },
] as const;

const SECTION_IDS = NAV_LINKS.filter((l) => l.section).map((l) => l.section as string);

// Scroll-spy: tracks which homepage section is currently in view so the nav
// can underline it, same idea as the /blog active state but scroll-driven.
function useActiveSection(pathname: string) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setActive(null);
      return;
    }

    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return active;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeSection = useActiveSection(pathname);

  function isActive(link: (typeof NAV_LINKS)[number]) {
    if (link.section) return pathname === "/" && activeSection === link.section;
    return pathname.startsWith(link.href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight">
            GetBack<span className="text-[var(--accent)]">SOL</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`border-b-2 px-3 py-2 text-[13px] font-medium tracking-tight transition-colors ${
                isActive(link)
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
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
            className="rounded-[8px] border border-[var(--border-strong)] p-2 lg:hidden"
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
              className={`rounded-[8px] border-l-2 px-3 py-2 text-sm transition-colors ${
                isActive(link)
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
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
