import postgres from "postgres";
import { writeFileSync } from "fs";

/**
 * Airdrop snapshot: allocates a fixed $GBS pool across every wallet by its
 * all-time XP, using the SAME formula as the public weekly leaderboard
 * (10 XP per reclaim, 1 XP per referral) so the distribution is transparent
 * and explainable — "your airdrop = your share of all XP earned".
 *
 * Read-only. Prints a table and writes airdrop-snapshot.json. Run it QUIETLY
 * before announcing the airdrop, so nobody can farm allocation last-minute.
 *
 *   DATABASE_URL=... node scripts/airdrop-snapshot.mjs
 *   AIRDROP_POOL=300000000 DATABASE_URL=... node scripts/airdrop-snapshot.mjs
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

// Must match src/lib/leaderboard.ts so the airdrop lines up with what users
// already see on the leaderboard.
const CLOSING_XP_PER_ACCOUNT = 10;
const REFERRAL_XP_PER_REFERRAL = 1;

const AIRDROP_POOL = Number(process.env.AIRDROP_POOL ?? 300_000_000);

const sql = postgres(url, { ssl: "require" });

try {
  const [closingRows, referralRows] = await Promise.all([
    sql`SELECT wallet, count(*)::int AS reclaims FROM reclaims GROUP BY wallet`,
    sql`SELECT partner_id AS wallet, count(*)::int AS referrals FROM referrals GROUP BY partner_id`,
  ]);

  const byWallet = new Map();
  for (const r of closingRows) {
    byWallet.set(r.wallet, { wallet: r.wallet, reclaims: r.reclaims, referrals: 0 });
  }
  for (const r of referralRows) {
    const e = byWallet.get(r.wallet) ?? { wallet: r.wallet, reclaims: 0, referrals: 0 };
    e.referrals = r.referrals;
    byWallet.set(r.wallet, e);
  }

  const entries = [...byWallet.values()].map((e) => ({
    ...e,
    xp: e.reclaims * CLOSING_XP_PER_ACCOUNT + e.referrals * REFERRAL_XP_PER_REFERRAL,
  }));

  const totalXp = entries.reduce((s, e) => s + e.xp, 0);
  if (totalXp === 0) {
    console.log("No activity yet — nothing to airdrop.");
    process.exit(0);
  }

  // Proportional allocation, floored to whole tokens. The rounding remainder
  // (a handful of tokens) is reported so you can send it to the treasury.
  let allocated = 0;
  const result = entries
    .map((e) => {
      const amount = Math.floor((e.xp / totalXp) * AIRDROP_POOL);
      allocated += amount;
      return { wallet: e.wallet, reclaims: e.reclaims, referrals: e.referrals, xp: e.xp, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  console.log(`\nAirdrop snapshot — pool ${AIRDROP_POOL.toLocaleString()} $GBS across ${result.length} wallets (total ${totalXp} XP)\n`);
  console.log("WALLET".padEnd(46), "XP".padStart(8), "TOKENS".padStart(16));
  for (const r of result.slice(0, 50)) {
    console.log(r.wallet.padEnd(46), String(r.xp).padStart(8), r.amount.toLocaleString().padStart(16));
  }
  if (result.length > 50) console.log(`... and ${result.length - 50} more (full list in airdrop-snapshot.json)`);
  console.log(`\nAllocated: ${allocated.toLocaleString()} — remainder to treasury: ${(AIRDROP_POOL - allocated).toLocaleString()}\n`);

  writeFileSync("airdrop-snapshot.json", JSON.stringify({ takenAt: new Date().toISOString(), pool: AIRDROP_POOL, totalXp, recipients: result }, null, 2));
  console.log("Wrote airdrop-snapshot.json");
} finally {
  await sql.end();
}
