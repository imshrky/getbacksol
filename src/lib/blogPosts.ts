export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  readingTime: string;
  content: BlogBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-solana-rent",
    title: "What is \"rent\" on Solana, and why do you get it back?",
    description:
      "Every account on Solana locks up a small SOL deposit to stay on the ledger. Here's what that deposit is, why it exists, and why closing an unused account refunds it.",
    publishedAt: "2026-06-02",
    readingTime: "4 min read",
    content: [
      {
        type: "p",
        text: "If you've used more than a handful of Solana wallets or tried a few different tokens, you've probably noticed your SOL balance is a little lower than you'd expect — even after selling everything. That missing SOL isn't a fee you paid to a DEX or a network gas cost. Most of the time, it's rent.",
      },
      { type: "h2", text: "Why Solana charges rent at all" },
      {
        type: "p",
        text: "Solana's validators keep the entire account database in memory for speed. Every account you create — your wallet, but also every individual token account tied to it — takes up space on every validator running the network, forever, unless it's closed. To stop the ledger from filling up with abandoned data, Solana requires every account to hold a minimum SOL balance proportional to its size. This is called the rent-exempt reserve: pay it once, and the account never gets deleted for running out of funds.",
      },
      {
        type: "p",
        text: "For a standard SPL token account, that reserve is about 0.00203928 SOL — roughly the smallest denomination that still matters at scale. It doesn't sound like much. But every time you buy a new token, swap into something out of curiosity, or receive an airdrop, Solana creates a brand new token account just to hold it, and locks a fresh 0.002 SOL into it.",
      },
      { type: "h2", text: "Why you don't get it back automatically" },
      {
        type: "p",
        text: "Selling a token doesn't close its account — it just leaves the balance at zero. The account itself, and the SOL locked inside it, sticks around until you (or a tool acting on your behalf) explicitly send a closeAccount instruction. Most wallets don't do this by default, because closing accounts costs a transaction and most users never think to do it. So the SOL just sits there, account after account, wallet after wallet.",
      },
      {
        type: "p",
        text: "Multiply 0.002 SOL by dozens of trades, airdrops, and token launches you tried once and forgot about, and it adds up to a meaningful amount sitting completely idle — money you already own, just locked behind an instruction nobody sent.",
      },
      { type: "h2", text: "Getting it back" },
      {
        type: "p",
        text: "The Solana Token Program only allows closeAccount on accounts with a zero balance — it's a network-level rule, not something any app can bypass. That's what makes reclaiming rent safe: it's mechanically impossible to close an account that still holds value. GetBackSOL scans your wallet for accounts that qualify, shows you exactly how much each one returns, and closes them in a single transaction you approve once.",
      },
    ],
  },
  {
    slug: "how-to-close-empty-token-accounts-solana",
    title: "How to close empty token accounts on Solana and get your SOL back",
    description:
      "A step-by-step walkthrough of closing dormant SPL token accounts on Solana to reclaim the locked rent — what it costs, what it returns, and what to check before you start.",
    publishedAt: "2026-06-09",
    readingTime: "5 min read",
    content: [
      {
        type: "p",
        text: "Closing an empty Solana token account takes about a minute once you know what you're looking for. Here's the full process, whether you use a tool for it or want to understand what's happening under the hood.",
      },
      { type: "h2", text: "1. Find out which accounts you can close" },
      {
        type: "p",
        text: "Not every token account is eligible — only ones sitting at exactly zero balance. You can check manually with a block explorer like Solscan by looking at your wallet's token holdings, or connect a wallet to a scanner tool that does it automatically. Either way, the accounts worth closing are the ones showing a balance of 0 for tokens you no longer hold.",
      },
      { type: "h2", text: "2. Understand what closeAccount actually does" },
      {
        type: "p",
        text: "closeAccount is a standard instruction in Solana's Token Program. It deletes the token account from the ledger and sends its rent-exempt reserve — the SOL that was locked when the account was created — to a destination address you choose (almost always your own wallet). The instruction requires a signature from the account's owner, and it will fail outright if the account isn't empty. There's no way to accidentally close an account that still holds tokens.",
      },
      { type: "h2", text: "3. Batch it if you have more than one" },
      {
        type: "p",
        text: "If you've got several dormant accounts, you don't need a separate transaction for each one — Solana lets you bundle multiple instructions into a single transaction, as long as it stays under the network's size limit (roughly ten closeAccount instructions per transaction in practice). This matters because each transaction, even a tiny one, takes a moment and a signature — batching means one approval closes everything at once instead of ten.",
      },
      { type: "h2", text: "4. Watch for accounts that aren't quite empty" },
      {
        type: "p",
        text: "Some accounts hold a tiny, effectively worthless balance — a fraction of a spam token, or dust left over from a swap that didn't round to zero. These can't be closed directly; the balance has to be burned to zero first. Tools that support this usually call it something like \"Safe-Burn,\" and it adds one extra instruction (burn) before the close.",
      },
      { type: "h2", text: "5. Do it with a tool instead of by hand" },
      {
        type: "p",
        text: "Building and signing raw Solana instructions by hand is possible but unforgiving — one wrong account reference and the transaction just fails (it can't succeed against the wrong account, so the risk is a wasted attempt, not a wrong closure). GetBackSOL handles the scanning, batching, and instruction-building for you: connect your wallet, review the accounts and amounts, and approve once. You keep 85% of whatever's reclaimed; the rest covers the service.",
      },
    ],
  },
  {
    slug: "why-does-my-wallet-have-so-many-token-accounts",
    title: "Why does my Solana wallet have so many token accounts?",
    description:
      "Airdrops, one-off swaps, and memecoin trades all leave behind token accounts you never asked for. Here's where they come from and why your wallet accumulates them.",
    publishedAt: "2026-06-16",
    readingTime: "3 min read",
    content: [
      {
        type: "p",
        text: "Open a Solana wallet that's been active for even a few months and you'll often find a long list of tokens you don't remember acquiring — most with a balance of zero. This isn't a bug, and it isn't spam getting into your wallet on its own. It's a side effect of how Solana handles tokens at the account level.",
      },
      { type: "h2", text: "Every token needs its own account" },
      {
        type: "p",
        text: "Unlike some blockchains where your single address just tracks a balance for every token, Solana creates a dedicated account — an Associated Token Account — the first time your wallet touches a given token. That happens automatically whenever you:",
      },
      {
        type: "ul",
        items: [
          "Buy or swap into a token, even briefly",
          "Receive an airdrop you didn't request",
          "Mint an NFT or interact with a program that issues a token as a receipt",
          "Get sent a token directly by someone else, unsolicited",
        ],
      },
      {
        type: "p",
        text: "Every one of those events silently creates a new account and locks a small SOL deposit into it. Sell the token, and the account stays — empty, but still there, still holding that deposit.",
      },
      { type: "h2", text: "Airdrop farming makes it worse" },
      {
        type: "p",
        text: "Projects looking to build a holder base for a future airdrop will often send tiny amounts of a new token to thousands of wallets that meet some on-chain criteria — no action required from you at all. If you've ever been active in Solana DeFi or NFTs, there's a good chance dozens of these unsolicited tokens have landed in your wallet over time, each one leaving a dormant account behind once you ignore or dump it.",
      },
      { type: "h2", text: "What it costs you" },
      {
        type: "p",
        text: "Each dormant account is only about 0.002 SOL — trivial on its own. But wallets that have been through a few market cycles regularly accumulate 10, 30, even 100+ of these. At that scale it's not pocket change anymore; it's SOL you already technically own, just sitting inert instead of in your spendable balance.",
      },
    ],
  },
  {
    slug: "is-closing-solana-token-account-safe",
    title: "Is closing a Solana token account safe? What actually happens on-chain",
    description:
      "closeAccount is a standard, network-enforced instruction — not a workaround. Here's exactly what happens on-chain and why it can't touch tokens that still hold value.",
    publishedAt: "2026-06-23",
    readingTime: "4 min read",
    content: [
      {
        type: "p",
        text: "Anytime an action involves signing a wallet transaction, it's worth asking what could go wrong. With closeAccount specifically, the honest answer is: less than you'd think, because the safety check isn't implemented by whichever app you're using — it's enforced by the Solana Token Program itself.",
      },
      { type: "h2", text: "The zero-balance rule is enforced on-chain" },
      {
        type: "p",
        text: "closeAccount is one of the core instructions defined in Solana's SPL Token Program — the same program every wallet, exchange, and dApp uses to move tokens. Its logic explicitly checks the account's token balance before doing anything else, and if that balance isn't exactly zero, the entire transaction fails. Not partially — the whole thing reverts. There's no code path where an app, malicious or careless, can force a close on an account that still holds tokens. It's a rule of the network, not a courtesy of whatever interface you're using.",
      },
      { type: "h2", text: "What gets signed, and by whom" },
      {
        type: "p",
        text: "Closing an account requires a signature from that account's authority — normally, your own wallet. Any legitimate tool builds the transaction and asks your wallet to sign it; your wallet shows you what you're approving, and nothing is broadcast to the network without that signature. Non-custodial means exactly that: the app never holds your keys or has the ability to sign on your behalf.",
      },
      { type: "h2", text: "Where the reclaimed SOL goes" },
      {
        type: "p",
        text: "When an account closes, its rent-exempt reserve is transferred to whichever address is specified as the destination in the instruction — for a legitimate tool, that's your own wallet, in the same transaction. A well-built tool will show you the destination and the exact amount before you sign, and any service fee is a separate, visible instruction in that same transaction rather than something quietly deducted afterward.",
      },
      { type: "h2", text: "What to actually check before you use a tool" },
      {
        type: "ul",
        items: [
          "Does it show you the exact accounts and amounts before you sign, or does it ask for a blind approval?",
          "Is the fee explicit and calculated before you confirm, not a surprise after?",
          "Has the project disclosed whether it's been independently audited, and is it honest if it hasn't?",
        ],
      },
      {
        type: "p",
        text: "The underlying instruction is safe by design. The thing actually worth scrutinizing is the app wrapped around it — how transparent it is about what it's doing and what it takes.",
      },
    ],
  },
  {
    slug: "solana-rent-reclaim-fees-explained",
    title: "SOL rent reclaim: what to expect (fees, timing, and how much comes back)",
    description:
      "A transparent breakdown of what happens when you reclaim rent from dormant Solana token accounts — the math, the timing, and where the service fee comes from.",
    publishedAt: "2026-06-30",
    readingTime: "3 min read",
    content: [
      {
        type: "p",
        text: "Before connecting a wallet to any tool that touches your funds, it's reasonable to want the exact numbers up front. Here's what actually happens when you reclaim rent, without the marketing gloss.",
      },
      { type: "h2", text: "How much comes back per account" },
      {
        type: "p",
        text: "A standard SPL token account locks roughly 0.00203928 SOL as its rent-exempt reserve. That's the amount returned when it closes — the exact figure can vary very slightly depending on the account's data size, but it's consistently in that range. Ten dormant accounts is roughly 0.02 SOL; fifty is roughly 0.1 SOL. Individually small, but it's a fixed, known amount per account, not a variable payout.",
      },
      { type: "h2", text: "Where the service fee comes from" },
      {
        type: "p",
        text: "Running a scanner, an RPC connection reliable enough for real transactions, and the infrastructure behind it isn't free. GetBackSOL takes a 15% cut of the SOL reclaimed — calculated on the gross amount, shown before you sign, and transferred in the same atomic transaction as the closure itself. There's no separate charge, no subscription, and nothing deducted after the fact: what you see in the \"you receive\" line before confirming is exactly what lands in your wallet.",
      },
      { type: "h2", text: "How long it takes" },
      {
        type: "p",
        text: "Solana transactions typically confirm in a few seconds. Closing accounts in batches (up to around ten per transaction, due to Solana's transaction size limit) means even a wallet with dozens of dormant accounts is usually done in well under a minute of actual wait time, across however many transactions it takes.",
      },
      { type: "h2", text: "What it costs to try" },
      {
        type: "p",
        text: "Normally, sending any Solana transaction requires a small amount of SOL in your wallet to cover the network fee — a real problem if your wallet is down to nothing but dead token accounts. Gasless setups solve this by having the platform itself cover that tiny network fee, so a wallet with genuinely zero SOL can still use the tool and walk away with a positive balance.",
      },
    ],
  },
  {
    slug: "gasless-solana-transactions-zero-sol",
    title: "Gasless transactions on Solana: closing accounts with zero SOL in your wallet",
    description:
      "Every Solana transaction needs a fee payer with SOL — which is a problem if your wallet is completely empty. Here's how gasless relaying solves it.",
    publishedAt: "2026-07-07",
    readingTime: "4 min read",
    content: [
      {
        type: "p",
        text: "There's a specific, almost absurd problem that affects exactly the people a rent-reclaim tool is built for: if your wallet has genuinely zero SOL — nothing but a pile of dead token accounts — you can't sign any transaction at all, including the one that would give you SOL back.",
      },
      { type: "h2", text: "Why every transaction needs a fee payer" },
      {
        type: "p",
        text: "Every Solana transaction designates a fee payer — the account whose balance covers the network fee, typically a fraction of a cent. By default, that's whoever initiates the transaction: you. If your balance is zero, there's nothing to pay the fee with, and the transaction can't be submitted. It's a hard requirement of the network, not a setting anyone can turn off.",
      },
      { type: "h2", text: "How gasless relaying works" },
      {
        type: "p",
        text: "The fix doesn't change who authorizes the transaction — it changes who pays for it. A transaction can have two signers: you, authorizing the closeAccount instructions on your own accounts, and a separate fee-payer wallet controlled by the platform, covering the tiny network cost. Your wallet signs to prove ownership; it never needs to hold SOL to do that.",
      },
      {
        type: "p",
        text: "Concretely: the app builds the transaction with the platform's wallet set as fee payer, your wallet signs its part, and the signed (but not yet submitted) transaction goes to a server that adds its own signature and sends it to the network.",
      },
      { type: "h2", text: "The part that actually matters: what stops abuse" },
      {
        type: "p",
        text: "A \"we'll pay your fees\" endpoint is only safe if it's picky about what it's willing to co-sign. Before adding its signature, the server should check, instruction by instruction, that the transaction only contains closeAccount calls and the expected fee transfer — nothing else. Without that check, anyone could use the same endpoint to get arbitrary transactions paid for, draining the fee-payer wallet. It's a small operational float either way (never user funds — just enough SOL to cover network fees), but it's still worth locking down properly rather than trusting the client to only ever send what it's supposed to.",
      },
      { type: "h2", text: "Why it matters for this specific product" },
      {
        type: "p",
        text: "Without gasless support, the wallets that would benefit most from a rent-reclaim tool — the ones with nothing left but dormant accounts — are exactly the ones locked out of using it. Removing the SOL requirement isn't a convenience feature here; it's the difference between the tool working for its actual target audience or not.",
      },
    ],
  },
  {
    slug: "solana-token-account-rent-faq",
    title: "Solana token account rent: a complete FAQ",
    description:
      "Every common question about Solana rent, dormant token accounts, and reclaiming SOL — answered directly, without the marketing language.",
    publishedAt: "2026-07-08",
    readingTime: "6 min read",
    content: [
      { type: "h2", text: "What is rent on Solana?" },
      {
        type: "p",
        text: "A SOL deposit locked into every account (wallets, token accounts, program accounts) to keep it stored on the network. Pay it once when the account is created; get it back when the account is closed.",
      },
      { type: "h2", text: "How much rent does a token account lock?" },
      {
        type: "p",
        text: "About 0.00203928 SOL for a standard SPL token account — small individually, but it adds up across dozens of dormant accounts.",
      },
      { type: "h2", text: "Do I lose rent when I sell a token?" },
      {
        type: "p",
        text: "No — selling drops the balance to zero but doesn't close the account. The rent stays locked until someone sends a closeAccount instruction. Selling and reclaiming rent are two separate actions.",
      },
      { type: "h2", text: "Can closing an account destroy tokens I still hold?" },
      {
        type: "p",
        text: "No. The Token Program rejects closeAccount outright on any account with a nonzero balance — this is enforced by the network, not by whichever app you're using.",
      },
      { type: "h2", text: "What's a \"dust\" token account?" },
      {
        type: "p",
        text: "An account with a technically nonzero but practically worthless balance — a fraction of a spam token, or a rounding remainder from a swap. It can't be closed until that balance is burned to zero first.",
      },
      { type: "h2", text: "Why do wallets accumulate so many dormant accounts?" },
      {
        type: "p",
        text: "Every new token you touch — bought, swapped, airdropped, or received unsolicited — creates its own account. None of them clean themselves up automatically.",
      },
      { type: "h2", text: "Can I reclaim rent without any SOL in my wallet?" },
      {
        type: "p",
        text: "Only with a tool that supports gasless transactions, where the platform covers the tiny network fee instead of you. Without that, you need a small amount of SOL just to pay for the closing transaction itself.",
      },
      { type: "h2", text: "Is there a fee for reclaiming rent through a tool?" },
      {
        type: "p",
        text: "Typically yes — running the infrastructure isn't free. Look for a tool that shows the fee and the net amount you'll receive before you sign, not after.",
      },
      { type: "h2", text: "Is this the same on every blockchain?" },
      {
        type: "p",
        text: "No — this is specific to Solana's account-rent model. Chains that track balances differently (Ethereum, for example) don't lock a per-account deposit the same way.",
      },
    ],
  },
  {
    slug: "before-you-use-a-solana-rent-reclaim-tool",
    title: "What to check before you use any Solana rent-reclaim tool",
    description:
      "A rent-reclaim tool touches your wallet directly. Here's a short, honest checklist for evaluating one — including questions we think GetBackSOL should have to answer too.",
    publishedAt: "2026-07-09",
    readingTime: "3 min read",
    content: [
      {
        type: "p",
        text: "Any tool that asks you to connect a wallet and sign a transaction deserves a moment of scrutiny first — including this one. Here's what's actually worth checking, regardless of which tool you end up using.",
      },
      { type: "h2", text: "Does it show you the exact numbers before you sign?" },
      {
        type: "p",
        text: "You should see the gross amount, the fee, and the net amount you'll receive before approving anything — not an estimate, not a range, and definitely not a blind signature request.",
      },
      { type: "h2", text: "Is it non-custodial?" },
      {
        type: "p",
        text: "The tool should build transactions for your wallet to sign, and never ask for your seed phrase or private key under any circumstance. If something asks for either, that's not a rent-reclaim tool anymore.",
      },
      { type: "h2", text: "Has it been audited — and does it say so honestly?" },
      {
        type: "p",
        text: "Most tools in this space, including newer ones, haven't had an external security audit yet. That's not automatically disqualifying for a tool built on standard, well-tested Token Program instructions rather than custom on-chain logic — but a project that's upfront about not being audited yet is telling you more than one that stays quiet about it.",
      },
      { type: "h2", text: "Where does the fee wallet's authority sit?" },
      {
        type: "p",
        text: "A single private key controlling a platform's fee wallet is a normal starting point for a new project, but it's worth knowing whether that's the case, and whether there's a plan to move to a multisig as volume grows.",
      },
      { type: "h2", text: "Does the marketing match the reality?" },
      {
        type: "p",
        text: "Claimed user counts and revenue figures are easy to publish and hard to verify from the outside. A devnet-only project that presents itself as a mature, high-volume platform is a bigger red flag than a small project that's upfront about being early.",
      },
      { type: "h2", text: "Where GetBackSOL stands on this, right now" },
      {
        type: "p",
        text: "Live on Solana mainnet, non-custodial, fees shown before every signature — and not yet externally audited, which is disclosed directly on the site rather than left out. That's the honest state of things today, not a claim about tomorrow.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
