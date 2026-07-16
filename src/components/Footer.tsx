"use client";

import Link from "next/link";
import { AtSign, MessageCircle, Code2, FileCode } from "lucide-react";
import { RpcStatus } from "./ui/RpcStatus";
import { LogoMark } from "./ui/Logo";
import { NETWORK } from "@/app/providers";

const IS_MAINNET = NETWORK === "mainnet-beta";

const LINKS = [
  { href: "https://x.com/GetBackSOL", label: "X / Twitter", icon: AtSign, external: true },
  { href: "https://telegram.me/GetBackSOL", label: "Telegram", icon: MessageCircle, external: true },
  { href: "https://github.com/imshrky/getbacksol", label: "Source code", icon: Code2, external: true },
  { href: "/docs", label: "API docs", icon: FileCode, external: false },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/copyright", label: "Copyright" },
];

export default function Footer() {
  return (
    <footer className="rule mt-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight">
              GetBack<span className="text-[var(--accent)]">SOL</span>
            </span>
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            {IS_MAINNET
              ? "GetBackSOL is live on Solana mainnet — transactions are real and final. The code has passed an external security audit."
              : "GetBackSOL is currently a devnet preview — no real transactions are executed and no funds are at risk until mainnet integration and a security review are complete."}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Links</span>
          {LINKS.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center gap-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            )
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Status</span>
          <RpcStatus />
        </div>
      </div>

      <div className="rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-5 sm:justify-start sm:px-6">
          {LEGAL_LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center gap-3">
              {i > 0 && <span className="text-[var(--border-strong)]">·</span>}
              <Link
                href={link.href}
                className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
