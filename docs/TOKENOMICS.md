# $GBS Tokenomics — DRAFT PROPOSAL

> This is a **starting proposal**, not final. Every number is a placeholder for
> you to change. Nothing here is legal or financial advice — see the legal note
> at the bottom, which is not optional before launch.

## The core idea

$GBS is a **utility token**, not a revenue-share token. Holders get **cheaper
reclaims** and community perks. It is deliberately **not** "stake and earn a cut
of our fees" at launch — that framing looks like a security (dividend) and is the
single biggest legal risk. The revenue-share/staking model can come later, only
after a lawyer signs off and it's structured properly.

Your edge over a pure meme coin: **you have a real product with real revenue.**
The token plugs into it. Lean into that.

## Supply & distribution (proposal)

- **Ticker:** $GBS
- **Total supply:** 1,000,000,000 (1 billion) — fixed, mint authority revoked at launch
- **Decimals:** 6 (Solana standard)

| Allocation | % | Amount | Notes |
|---|---|---|---|
| Community airdrop | 30% | 300,000,000 | To existing users, by all-time XP (see airdrop script) |
| Liquidity pool | 30% | 300,000,000 | Paired with SOL, **LP locked** |
| Treasury / future incentives | 20% | 200,000,000 | Product growth, future rewards (locked/vested) |
| Team | 10% | 100,000,000 | **Vested** (e.g. 6–12 month cliff) — non-negotiable for trust |
| Marketing / partnerships | 10% | 100,000,000 | Campaigns, listings, KOLs |

**Rules that keep it non-rug (do all of these):**
- Revoke mint authority at launch (no infinite printing)
- Lock the liquidity (so it can't be pulled)
- Vest the team allocation publicly
- Announce all wallet addresses so holders can verify

## Utility (what makes holding worth it)

**Tier 1 — Holder fee discount** (implemented, dormant until the mint exists):
- Hold ≥ **`HOLDER_MIN_BALANCE`** $GBS → your reclaim service fee drops from **30% to 15%** (50% off).
- Config-driven via `NEXT_PUBLIC_GBS_TOKEN_MINT`, `NEXT_PUBLIC_GBS_HOLDER_MIN_BALANCE`, `NEXT_PUBLIC_GBS_HOLDER_FEE_RATE` (see `src/lib/tokenDiscount.ts`).
- Concrete reason to buy and hold → real demand, no revenue promise.

**Tier 2 — Community / access** (no code needed, or later):
- Priority support, early access to new tools, leaderboard boosts, a holders-only Telegram tier.

**Phase 2 — governance / rewards** (only after legal review):
- Voting on fee rate, new tools, treasury use.
- A compliant rewards mechanic, if a lawyer greenlights it.

## Launch mechanics (proposal)

- **Fair-ish launch** via a launchpad (e.g. pump.fun) or a seeded Raydium pool.
- **Snapshot the airdrop BEFORE announcing** (so people can't farm it last-minute) — see `scripts/airdrop-snapshot.mjs`.
- Countdown to **Aug 20, 2026** (already on the site roadmap).
- Coordinate the drop across X + Telegram (automation already in place) + the group.

## ⚠️ Legal note — read before doing anything

A token tied to a revenue-generating platform, sold to the public, can be
classified as a **security** (Howey test), especially anything resembling
"hold/stake to earn income." This proposal deliberately avoids that at launch by
sticking to **access utility (fee discount)** rather than profit-sharing. Even so:
**get a crypto lawyer to review the model, the copy, and the distribution before
launch.** This is the one step you cannot skip or automate.
