"use client";

import Link from "next/link";
import { AtSign, MessageCircle, Code2 } from "lucide-react";
import { RpcStatus } from "./ui/RpcStatus";
import { NETWORK } from "@/app/providers";

const IS_MAINNET = NETWORK === "mainnet-beta";

// TODO: swap these placeholder hrefs for the real profile/repo URLs.
const LINKS = [
  { href: "#", label: "X / Twitter", icon: AtSign },
  { href: "#", label: "Discord", icon: MessageCircle },
  { href: "#", label: "Source code", icon: Code2 },
];

export default function Footer() {
  return (
    <footer className="rule mt-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--accent)] text-xs font-bold text-[var(--accent-ink)]">
              G
            </span>
            <span className="text-sm font-semibold tracking-tight">
              GetBack<span className="text-[var(--accent)]">SOL</span>
            </span>
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            {IS_MAINNET
              ? "GetBackSOL is live on Solana mainnet — transactions are real and final. The code has not yet had an external security audit; use at your own risk."
              : "GetBackSOL is currently a devnet preview — no real transactions are executed and no funds are at risk until mainnet integration and a security review are complete."}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Links</span>
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              <link.icon className="h-3.5 w-3.5" />
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Status</span>
          <RpcStatus />
        </div>
      </div>
    </footer>
  );
}
