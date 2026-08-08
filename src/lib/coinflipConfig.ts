// Shared between client and server (no "server-only" guard) — just the
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
// RTP / 2 — the number that makes the long-run average payout equal RTP.
export const COINFLIP_WIN_PROBABILITY = COINFLIP_RTP / 2;

export const COINFLIP_PRESET_AMOUNTS_SOL = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5] as const;
