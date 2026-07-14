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
