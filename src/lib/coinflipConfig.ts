// Shared between client and server (no "server-only" guard): just the
// odds/wager constants both the game UI and the resolve route need to agree
// on. The actual RNG/crypto logic (which needs Node's crypto module and the
// secret server seed) stays server-only in coinflip.ts.

// RTP (return to player): the fraction of every SOL wagered that comes back
// across many rounds, on average. A fair 50/50 coin at 2x payout would be
// 100% RTP; this is the house edge, same mechanism most real-money coin
// flip products use (moving the *odds*, not adding a separate visible fee).
// 0.97 mirrors the reference product's own advertised rate.
export const COINFLIP_RTP = 0.97;

// Payout is always exactly double the wager, so win probability is simply
// RTP / 2, the number that makes the long-run average payout equal RTP.
export const COINFLIP_WIN_PROBABILITY = COINFLIP_RTP / 2;

export const COINFLIP_PRESET_AMOUNTS_SOL = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5] as const;

// Degen mode: the same game at much higher stakes. Separate list rather than
// simply raising the standard ones, so the big numbers are always a
// deliberate opt-in rather than something a player can hit by mis-tapping.
export const COINFLIP_DEGEN_AMOUNTS_SOL = [1, 2, 5, 10] as const;

export const COINFLIP_ALL_AMOUNTS_SOL = [
  ...COINFLIP_PRESET_AMOUNTS_SOL,
  ...COINFLIP_DEGEN_AMOUNTS_SOL,
] as const;

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Headroom kept on top of a potential payout when judging whether the house
 * can cover a wager: network fees, and a margin so two rounds resolving at
 * almost the same moment can't leave the second one unpayable.
 */
export const HOUSE_BUFFER_LAMPORTS = 20_000_000; // 0.02 SOL

/**
 * The largest wager the house could actually pay out on, given its balance.
 * A win pays double, so capacity is half of what's available after the
 * buffer. Used to grey out unaffordable stakes *before* the player commits
 * money, which matters much more in degen mode: without it a big wager can
 * be taken on-chain and only then fail the bankroll check at resolve time,
 * leaving the player paid up with no round played.
 */
export function maxAffordableWagerLamports(houseBalanceLamports: number): number {
  return Math.max(0, Math.floor((houseBalanceLamports - HOUSE_BUFFER_LAMPORTS) / 2));
}

export function isAmountAffordable(amountSol: number, maxWagerLamports: number | null): boolean {
  if (maxWagerLamports === null) return true; // capacity unknown, let the server decide
  return Math.round(amountSol * LAMPORTS_PER_SOL) <= maxWagerLamports;
}
