# $GBS Launch Checklist — target Aug 20, 2026

A 15-day plan from Aug 5. Realistic but tight. Items marked 🔴 are blockers —
if they slip, the date slips. Items marked 👤 only you can do (decisions, money,
signing, legal). Items marked 🤖 I can do.

---

## Days 1–3 (Aug 5–7) — Decide & de-risk

- [ ] 👤🔴 **Finalize tokenomics numbers** — edit `docs/TOKENOMICS.md`: supply split, holder threshold, discount rate, vesting.
- [ ] 👤🔴 **Talk to a crypto lawyer** — validate the utility-not-dividend model and the launch copy. Start this NOW; it's the longest lead time.
- [ ] 👤 **Fix the audit claim** on the site before buyers scrutinize it (a false "audited" claim on a token people buy is materially worse than on a free tool). 🤖 I can do the edits once you decide the true wording.
- [ ] 👤 **Decide launch venue** — pump.fun (fast, meme-y) vs a seeded Raydium pool (more control, needs SOL upfront).

## Days 3–6 (Aug 7–10) — Build & prepare

- [ ] 🤖 **Airdrop snapshot logic** — done (`scripts/airdrop-snapshot.mjs`). Run a dry-run against the DB to see the allocation table.
- [ ] 🤖 **Holder fee-discount** — done (`src/lib/tokenDiscount.ts`), dormant until the mint is set. Needs the mint address + on-chain testing to activate.
- [ ] 👤 **Prepare wallets** — the token mint wallet, treasury, team (multisig recommended), marketing. Fund what needs funding.
- [ ] 👤🔴 **Decide the SOL you'll seed liquidity with** — real capital. Bigger pool = less volatile, more trust.

## Days 6–10 (Aug 10–14) — Create the token

- [ ] 👤🔴 **Create the mint** — SPL token with metadata (name, symbol $GBS, image). Via a launchpad or Metaplex.
- [ ] 👤🔴 **Revoke mint authority** + freeze authority — publicly, so supply is fixed.
- [ ] 👤 **Set the env vars** on Vercel: `NEXT_PUBLIC_GBS_TOKEN_MINT`, `NEXT_PUBLIC_GBS_HOLDER_MIN_BALANCE`, `NEXT_PUBLIC_GBS_HOLDER_FEE_RATE` → activates the holder discount.
- [ ] 🤖 **Test the holder discount on-chain** with a wallet that holds $GBS (decode the reclaim tx, confirm the reduced fee) — must be verified before it's trusted with real money.

## Days 10–13 (Aug 14–17) — Snapshot & stage

- [ ] 👤🔴 **Take the airdrop snapshot** (run the script, save the output) — do this quietly, BEFORE announcing, so nobody farms it.
- [ ] 🤖 **Draft the launch campaign** — X thread, Telegram announcement, countdown posts. Slot into the existing automation.
- [ ] 👤 **Line up liquidity + LP lock** — pool ready to seed on launch day, lock tool chosen.
- [ ] 👤 **Prepare the distribution** — how airdropped tokens actually reach wallets (batch transfer script, or claim page).

## Days 13–15 (Aug 17–20) — Launch

- [ ] 👤🔴 **Aug 20 — Seed liquidity + open trading** + lock LP.
- [ ] 👤 **Execute the airdrop** distribution.
- [ ] 🤖 **Fire the launch campaign** (X + Telegram + group).
- [ ] 👤 **Publish all wallet addresses** (mint, LP lock, team vesting, treasury) for transparency.
- [ ] 👤 **Watch Helius load** — a launch spikes RPC usage; make sure the plan holds.

---

## The honest risk summary

- **Legal is the real gate.** If the lawyer isn't done, don't launch a public sale — soft-launch as pure community/meme with zero income framing instead.
- **2 weeks is doable for a simple launch, tight for a polished one.** If it slips, moving the date beats shipping something that looks like a rug.
- **Don't skip anti-rug steps** (revoke mint, lock LP, vest team). Skipping them tanks trust and the token with it.
