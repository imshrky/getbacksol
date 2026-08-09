"use client";

import { Bell } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "getbacksolbot";

/**
 * One-tap opt-in for automatic Telegram alerts on this wallet. Deep-links to
 * the bot with a start=wallet_<address> payload; the webhook binds the chat to
 * the wallet and the /api/cron/wallet-alerts cron pings it when new reclaimable
 * SOL appears. This single tap is required because Telegram forbids a bot from
 * messaging anyone who hasn't started it — after it, everything is automatic.
 */
export function TelegramAlertsButton({ address }: { address: string }) {
  const href = `https://t.me/${BOT_USERNAME}?start=wallet_${address}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("telegram_alerts_optin", { wallet: address })}
      className="flex items-center justify-center gap-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)]"
    >
      <Bell className="h-4 w-4 text-[var(--accent)]" />
      Get Telegram alerts when this wallet has SOL to reclaim
    </a>
  );
}
