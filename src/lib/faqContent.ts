import { NETWORK } from "@/app/providers";

const IS_MAINNET = NETWORK === "mainnet-beta";

// Single source of truth for the FAQ — shared between the homepage
// (page.tsx, also feeds the FAQPage JSON-LD schema there) and the
// Telegram bot's /faq command (see telegram/webhook/route.ts), so the two
// can never silently drift apart.
export const FAQ_ITEMS = [
  {
    q: "What is this locked SOL, exactly?",
    a: "Every SPL token account you own — even ones for tokens you no longer hold — locks a small rent-exempt deposit (~0.00204 SOL) to stay on the Solana ledger. Closing an empty account releases that deposit back to you.",
  },
  {
    q: "Is closing an account safe?",
    a: "Yes. The Token Program only allows closing accounts with a zero balance, so it's physically impossible to close an account that still holds value.",
  },
  {
    q: "What about accounts with leftover dust?",
    a: "Turn on Safe-Burn and we'll burn the residual balance first, in the same transaction, so the account qualifies for closing too. You can also turn on Sell dust for SOL — when a token is actually worth something and your wallet already holds wrapped SOL, we'll try to sell it instead of burning it, and you keep 100% of the proceeds; tokens with no viable route just get burned as usual.",
  },
  {
    q: "Why a 15% fee?",
    a: "The service fee covers RPC infrastructure and keeps the tool running. It's calculated on the amount reclaimed and sent in the same atomic transaction — you always see the exact net amount before confirming.",
  },
  {
    q: "Is GetBackSOL custodial?",
    a: "No. We never hold your keys or your funds. Every transaction is built by the app but signed only by your wallet, and SOL is sent directly to your address.",
  },
  {
    q: "Is this live on mainnet?",
    a: IS_MAINNET
      ? "Yes. GetBackSOL is live on Solana mainnet — every transaction moves real SOL and the 15% fee is real. There's no test mode here anymore."
      : "GetBackSOL is currently in devnet testing ahead of a mainnet launch. Connect a devnet wallet to try the full flow — nothing here touches real funds yet.",
  },
];
