-- GetBackSOL partner program schema. Run once via `npm run db:migrate`
-- (see scripts/migrate.mjs) against DATABASE_URL. Safe to re-run: every
-- statement is idempotent.

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  payout_wallet TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  revenue_share NUMERIC NOT NULL DEFAULT 0.30,
  signup_ip TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
