// Reply templates for the auto-reply cron. No URLs (X charges $0.20/post for
// links vs $0.015 for plain text) — the account's bio carries the actual
// link, so a reply just needs to point people at the profile.
export const REPLY_TEMPLATES: string[] = [
  "That's rent you can actually get back 🔒 Check our profile, it's a 1-click tool for exactly this.",
  "You can reclaim the SOL locked in that account. We built a tool for it, link's in our bio 👀",
  "Every dead token account is still holding locked SOL. Worth checking, it's in our profile 🔓",
  "Closing that gets your rent deposit back in one transaction. Tool's in our bio if you want to check your wallet 💸",
  "That SOL isn't gone, just locked. We made a tool to get it back, check our profile 🟢",
];

export function pickRandomReply(): string {
  return REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];
}
