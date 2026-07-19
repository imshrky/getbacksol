import "server-only";
import { getCurrentWeekWindow, getWeeklyPrizePoolLamports } from "./leaderboard";
import { getPlatformStats } from "./reclaims";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Written for an already-subscribed audience (channel members, not cold
// traffic) — reminders and features, not "come check us out" pitches.
const STATIC_POSTS: string[] = [
  "Reminder: every empty token account you never closed is still holding ~0.002 SOL. Come back and check for new ones: getbacksol.com",
  "Your referral link earns you 60% of the fee on every reclaim it brings in — for as long as it keeps happening, not just once. Find yours after connecting a wallet: getbacksol.com",
  "Turn on Sell dust in Reclaim Rent and we try to sell your dust tokens for SOL via Jupiter instead of burning them — turning worthless-to-you dust into real SOL, minus the usual service fee.",
  "New guide on the blog: how Solana rent actually works, and why your wallet keeps piling up dead token accounts. getbacksol.com/blog",
  "GetBackSOL has passed an external security audit — non-custodial the whole way through, code's on GitHub if you want to check yourself.",
];

// Every 3rd rotation pulls the real, current leaderboard prize pool instead
// of a static line — a small live touch, cheap since the data's already
// computed for the public leaderboard (see leaderboard.ts).
const PRIZE_POOL_SLOT_EVERY = 3;
// Once a week, a milestone post with real all-time totals instead — the
// single highest-performing post type competitors run, but built from
// getPlatformStats() rather than a number someone typed in.
const MILESTONE_SLOT_EVERY = 7;

async function prizePoolPost(): Promise<string> {
  try {
    const window = getCurrentWeekWindow();
    const poolLamports = await getWeeklyPrizePoolLamports(window);
    const poolSol = (Number(poolLamports) / LAMPORTS_PER_SOL).toFixed(4);
    return `This week's leaderboard prize pool is at ${poolSol} SOL so far — split 50/30/20 between the top 3 closers/referrers. Check your rank: getbacksol.com/#weekly-leaderboard`;
  } catch {
    return STATIC_POSTS[0];
  }
}

async function milestonePost(): Promise<string> {
  try {
    const stats = await getPlatformStats();
    if (stats.totalAccountsClosed <= 0) return STATIC_POSTS[0];
    const solReclaimed = (Number(stats.totalNetLamports) / LAMPORTS_PER_SOL).toFixed(2);
    return `Where we're at right now:\n\n${solReclaimed} SOL reclaimed\n${stats.totalAccountsClosed.toLocaleString()} accounts closed\n${stats.uniqueWallets.toLocaleString()} wallets served\n\nReal numbers, pulled straight from the chain — verify any of it on Solscan. getbacksol.com`;
  } catch {
    return STATIC_POSTS[0];
  }
}

export async function getTelegramPost(dayIndex: number): Promise<string> {
  if (dayIndex % MILESTONE_SLOT_EVERY === 0) return milestonePost();
  if (dayIndex % PRIZE_POOL_SLOT_EVERY === 0) return prizePoolPost();
  return STATIC_POSTS[dayIndex % STATIC_POSTS.length];
}
