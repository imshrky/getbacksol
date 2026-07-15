-- GetBackSOL partner program schema. Run once via `npm run db:migrate`
-- (see scripts/migrate.mjs) against DATABASE_URL. Safe to re-run: every
-- statement is idempotent.

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  website TEXT,
  payout_wallet TEXT NOT NULL,
  api_key_hash TEXT UNIQUE,
  revenue_share NUMERIC NOT NULL DEFAULT 0.30,
  signup_ip TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'partner': self-service API signup at /partners (name/email required,
  -- has an API key). 'wallet': auto-provisioned the first time a connected
  -- wallet's own referral link earns a credit — no signup, id and
  -- payout_wallet are the same address, no email/api_key_hash.
  kind TEXT NOT NULL DEFAULT 'partner'
);

-- Existing deployments created these columns NOT NULL before the 'wallet'
-- kind existed — relax them so this migration stays idempotent whether
-- run against a fresh or an already-provisioned database.
ALTER TABLE partners ALTER COLUMN name DROP NOT NULL;
ALTER TABLE partners ALTER COLUMN email DROP NOT NULL;
ALTER TABLE partners ALTER COLUMN api_key_hash DROP NOT NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'partner';

CREATE INDEX IF NOT EXISTS partners_api_key_hash_idx ON partners (api_key_hash);
CREATE INDEX IF NOT EXISTS partners_signup_ip_idx ON partners (signup_ip);

CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners (id),
  tx_signature TEXT NOT NULL UNIQUE,
  gross_fee_lamports BIGINT NOT NULL,
  partner_share_lamports BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referrals_partner_id_idx ON referrals (partner_id);

-- Every successful reclaim transaction, referred or not — public activity
-- feed (see /api/reclaims/history), not just partner-attributed ones.
CREATE TABLE IF NOT EXISTS reclaims (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  tx_signature TEXT NOT NULL UNIQUE,
  accounts_closed INT NOT NULL,
  net_lamports BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reclaims_created_at_idx ON reclaims (created_at DESC);

-- Platform fee actually collected in this reclaim (already computed and
-- validated in /api/relay-close at record time) — needed to size the weekly
-- leaderboard prize pool, which is a share of real fee revenue, not a
-- made-up number. Defaults to 0 for rows recorded before this column
-- existed; those weeks are simply excluded from historical pool totals.
ALTER TABLE reclaims ADD COLUMN IF NOT EXISTS fee_lamports BIGINT NOT NULL DEFAULT 0;

-- One row per (week, rank) once a weekly leaderboard prize is actually paid
-- out — see src/lib/leaderboard.ts. Payouts are signed manually by whoever
-- holds the FEE_WALLET key (the app never holds that private key, see
-- feeWallet.ts), so this table only ever records payouts that already
-- happened on-chain; a row here is proof, not a promise.
CREATE TABLE IF NOT EXISTS weekly_payouts (
  id BIGSERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  rank INT NOT NULL,
  wallet TEXT NOT NULL,
  xp NUMERIC NOT NULL,
  amount_lamports BIGINT NOT NULL,
  tx_signature TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, rank)
);

CREATE INDEX IF NOT EXISTS weekly_payouts_week_start_idx ON weekly_payouts (week_start);

-- Per-partner-per-minute request counter for /api/v1/scan (see
-- src/lib/rateLimit.ts) — a fixed-window counter rather than a per-request
-- log, so this stays cheap even under real load. Self-prunes old windows
-- opportunistically instead of needing a separate cron job.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  partner_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (partner_id, window_start)
);
