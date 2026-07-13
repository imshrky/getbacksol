// Rotating pool of scheduled posts. Honest claims only, no invented stats.
// Rotation is date-derived (see route.ts) so it needs no persistent state.
export const SCHEDULED_POSTS: string[] = [
  "Every empty Solana token account is holding ~0.002 SOL hostage 🔒 We scan your wallet, close them, and send your SOL back. Non-custodial, live on mainnet. getbacksol.com",
  "Your wallet has more locked SOL than you think 👀 Every dead token account you never closed is still holding its rent deposit. Get it back: getbacksol.com",
  "Closing an empty Solana token account can't touch tokens that still hold value. It's enforced by the network itself, not a promise any app makes ✅ Reclaim yours: getbacksol.com",
  "No SOL left in your wallet? Doesn't matter 💸 GetBackSOL covers the network fee so you can still close dead accounts and walk away with SOL. getbacksol.com",
  "We show you the exact amount before you sign: gross, fee, net 📊 No surprises after the fact. Reclaim locked SOL: getbacksol.com",
  "GetBackSOL is live on Solana mainnet 🟢 Non-custodial, and upfront about not being audited yet. Check what your wallet is owed: getbacksol.com",
  "Airdrops, one-off swaps, memecoins you tried once 🎯 Every one of them left a dormant token account behind, still holding SOL. Go find them: getbacksol.com",
];
