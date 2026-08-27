import "server-only";
import { createHash, randomBytes } from "crypto";
import { getSql } from "./db";
import { COINFLIP_WIN_PROBABILITY } from "./coinflipConfig";

export {
  COINFLIP_RTP,
  COINFLIP_WIN_PROBABILITY,
  COINFLIP_PRESET_AMOUNTS_SOL,
  COINFLIP_DEGEN_AMOUNTS_SOL,
  COINFLIP_ALL_AMOUNTS_SOL,
} from "./coinflipConfig";

// Real-money, provably-fair coin flip. "Provably fair" here means a
// standard commit-reveal scheme: the server picks a secret seed and
// publishes its hash *before* the bet is placed (so it can't be changed
// after seeing the player's choice), then reveals the seed after
// resolving so anyone can recompute the outcome themselves and confirm it
// matches both the earlier commitment and the result they were shown.

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Deterministic outcome from the three committed inputs — same inputs
 * always produce the same result, which is the entire point: it lets
 * anyone independently recompute a past round and confirm it wasn't
 * tampered with. `side` (heads/tails) doesn't affect the odds at all — both
 * sides carry identical win probability, it's purely cosmetic which one the
 * player picks (see the coin animation), so it isn't part of this formula.
 */
export function computeOutcome(serverSeed: string, clientSeed: string, nonce: number | string): "win" | "loss" {
  const hash = createHash("sha256").update(`${serverSeed}:${clientSeed}:${nonce}`).digest("hex");
  // First 8 hex chars -> a value in [0, 1).
  const value = parseInt(hash.slice(0, 8), 16) / 0x100000000;
  return value < COINFLIP_WIN_PROBABILITY ? "win" : "loss";
}

/** Re-derives a round's outcome from its revealed inputs, for independent verification. */
export function verifyRound(
  serverSeed: string,
  commitHash: string,
  clientSeed: string,
  nonce: number | string
): { hashMatches: boolean; outcome: "win" | "loss" } {
  return {
    hashMatches: hashServerSeed(serverSeed) === commitHash,
    outcome: computeOutcome(serverSeed, clientSeed, nonce),
  };
}

export type RecentFlip = {
  wallet: string;
  side: string;
  wagerLamports: string;
  outcome: string;
  createdAt: string;
};

/** Public "Recent Flip" feed — every field here is independently verifiable on-chain already. */
export async function getRecentFlips(limit = 30): Promise<RecentFlip[]> {
  const rows = await getSql()`
    SELECT wallet, side, wager_lamports, outcome, resolved_at
    FROM coinflip_rounds
    WHERE resolved_at IS NOT NULL
      -- Every real resolution path fills all of these in together, but a
      -- half-written row (a manual DB fix, an interrupted migration) would
      -- otherwise reach the UI and crash its address-shortening on null.
      AND wallet IS NOT NULL
      AND outcome IS NOT NULL
      AND wager_lamports IS NOT NULL
    ORDER BY resolved_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    wallet: r.wallet,
    side: r.side,
    wagerLamports: String(r.wager_lamports),
    outcome: r.outcome,
    createdAt: new Date(r.resolved_at).toISOString(),
  }));
}
