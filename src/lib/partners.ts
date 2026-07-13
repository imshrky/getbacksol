import "server-only";
import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";
import { getSql } from "./db";

// Revenue-share offered to every self-service partner. Fixed rather than
// per-partner negotiable, since self-service signup has no human review —
// a uniform rate keeps the program simple and fair until a real partner
// needs a custom deal (at which point it'd be a manual DB update, not a
// product feature).
export const PARTNER_REVENUE_SHARE = 0.3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SIGNUPS_PER_IP_PER_DAY = 5;

export type PartnerSignupInput = {
  name: string;
  email: string;
  website?: string;
  payoutWallet: string;
};

export type PartnerSignupResult =
  | { ok: true; partnerId: string; apiKey: string; revenueShare: number }
  | { ok: false; error: string };

export type ResolvedPartner = { id: string; revenueShare: number };

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "partner";
}

function randomSuffix(): string {
  return crypto.randomBytes(3).toString("hex");
}

function generateApiKey(): string {
  return `gbs_live_${crypto.randomBytes(24).toString("base64url")}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Creates a partner account and issues an API key. Self-service, no manual
 * approval — so the only defenses against abuse are: a per-IP daily cap
 * (durable, DB-backed — not in-memory, which wouldn't survive serverless
 * cold starts), basic input validation, and the fact that the issued key
 * only grants read-only wallet scanning (see /api/v1/scan) — it can never
 * move funds. The raw key is returned once here and never stored; only its
 * SHA-256 hash is persisted, so a database leak can't be used to replay
 * partner keys.
 */
export async function signUpPartner(
  input: PartnerSignupInput,
  signupIp: string | null
): Promise<PartnerSignupResult> {
  const name = input.name?.trim().slice(0, 80);
  const email = input.email?.trim().toLowerCase().slice(0, 200);
  const website = input.website?.trim().slice(0, 200) || null;
  const payoutWallet = input.payoutWallet?.trim();

  if (!name || name.length < 2) return { ok: false, error: "Please enter a valid name." };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email." };
  if (website) {
    try {
      new URL(website);
    } catch {
      return { ok: false, error: "Website must be a valid URL (include https://)." };
    }
  }
  if (!payoutWallet) return { ok: false, error: "Payout wallet address is required." };
  try {
    new PublicKey(payoutWallet);
  } catch {
    return { ok: false, error: "Payout wallet must be a valid Solana address." };
  }

  const sql = getSql();

  if (signupIp) {
    const recent = await sql`
      SELECT count(*)::int AS count FROM partners
      WHERE signup_ip = ${signupIp} AND created_at > now() - interval '24 hours'
    `;
    if (recent[0].count >= MAX_SIGNUPS_PER_IP_PER_DAY) {
      return { ok: false, error: "Too many signups from this network today. Try again tomorrow." };
    }
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  for (let attempt = 0; attempt < 5; attempt++) {
    const partnerId = `${slugify(name)}-${randomSuffix()}`;
    try {
      await sql`
        INSERT INTO partners (id, name, email, website, payout_wallet, api_key_hash, revenue_share, signup_ip)
        VALUES (${partnerId}, ${name}, ${email}, ${website}, ${payoutWallet}, ${apiKeyHash}, ${PARTNER_REVENUE_SHARE}, ${signupIp})
      `;
      return { ok: true, partnerId, apiKey, revenueShare: PARTNER_REVENUE_SHARE };
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "23505") continue; // id or api_key_hash collision — retry with a new suffix
      throw e;
    }
  }

  return { ok: false, error: "Could not create a partner account. Please try again." };
}

/** Looks up a partner by their raw API key (hashed before the DB lookup). */
export async function resolvePartnerByApiKey(apiKey: string | null): Promise<ResolvedPartner | null> {
  if (!apiKey) return null;
  const hash = hashApiKey(apiKey);
  const rows = await getSql()`
    SELECT id, revenue_share FROM partners WHERE api_key_hash = ${hash} AND active = true
  `;
  if (rows.length === 0) return null;
  return { id: rows[0].id, revenueShare: Number(rows[0].revenue_share) };
}

/** Confirms a partner id (from a `?ref=` attribution tag) is real and active. */
export async function partnerExists(partnerId: string): Promise<ResolvedPartner | null> {
  const rows = await getSql()`
    SELECT id, revenue_share FROM partners WHERE id = ${partnerId} AND active = true
  `;
  if (rows.length === 0) return null;
  return { id: rows[0].id, revenueShare: Number(rows[0].revenue_share) };
}

/**
 * Records a partner's cut of a real, already-confirmed reclaim transaction.
 * `grossFeeLamports` must come from re-reading the validated transfer
 * instruction server-side (see /api/relay-close) — never from a
 * client-supplied number — so a partner can't inflate their own payout.
 */
export async function recordReferral(
  partnerId: string,
  txSignature: string,
  grossFeeLamports: bigint,
  revenueShare: number
): Promise<void> {
  const partnerShareLamports = (grossFeeLamports * BigInt(Math.round(revenueShare * 10_000))) / 10_000n;
  try {
    await getSql()`
      INSERT INTO referrals (partner_id, tx_signature, gross_fee_lamports, partner_share_lamports)
      VALUES (${partnerId}, ${txSignature}, ${grossFeeLamports.toString()}, ${partnerShareLamports.toString()})
    `;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") return; // already recorded for this signature
    throw e;
  }
}
