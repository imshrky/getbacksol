import type { Metadata } from "next";
import { Send, MessageCircle, ExternalLink } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Faq } from "@/components/ui/Faq";

export const metadata: Metadata = {
  title: "Support | GetBackSOL",
  description: "Get help with Reclaim Rent — reach us on Telegram or Discord, or check the FAQ.",
};

// TODO: swap these placeholder hrefs for the real channels once they exist —
// same convention as the social links in Footer.tsx.
const CHANNELS = [
  {
    href: "#",
    icon: Send,
    title: "Telegram",
    body: "Fastest way to reach us for account or transaction questions.",
  },
  {
    href: "#",
    icon: MessageCircle,
    title: "Discord",
    body: "Open a ticket in our server if you prefer async support.",
  },
];

const SUPPORT_FAQ_ITEMS = [
  {
    q: "My transaction failed — did I lose any SOL?",
    a: "No. Every reclaim transaction is atomic — either every instruction in it succeeds (accounts close, you get the rent, we get the fee) or none of it does. A failed transaction means nothing happened on-chain; check your wallet's activity or a block explorer if you want to confirm.",
  },
  {
    q: "My wallet isn't supported — what can I do?",
    a: "GetBackSOL connects through the Solana Wallet Standard, which covers Phantom, Solflare, Backpack, and most other modern Solana wallets. If yours doesn't show up in the connect menu, let us know on Telegram or Discord and we'll look into adding support.",
  },
  {
    q: "How long does support usually take?",
    a: "We're a small team, so response times vary, but Telegram is typically the fastest channel. Include your wallet address and, if relevant, the transaction signature so we can look into it directly.",
  },
  {
    q: "Do you ever need my private key or seed phrase?",
    a: "Never. We will never ask for your private key, seed phrase, or wallet password — on this site or through any support channel. Every transaction is signed by your wallet, not us; anyone asking for your keys is not us.",
  },
];

export default function SupportPage() {
  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Support"
        title="We're here to help"
        description="Reach us directly, or check the FAQ below for common questions."
      />

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <a
            key={channel.title}
            href={channel.href}
            className="surface-hover flex items-start gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <channel.icon className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">{channel.title}</h3>
                <ExternalLink className="h-3 w-3 text-[var(--muted)]" />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{channel.body}</p>
            </div>
          </a>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        <span className="eyebrow mb-4">Frequently asked</span>
        <Faq items={SUPPORT_FAQ_ITEMS} />
      </div>
    </div>
  );
}
