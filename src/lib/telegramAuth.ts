import "server-only";
import crypto from "crypto";

/**
 * Validates the `initData` string a Telegram Mini App hands to its page,
 * proving the request genuinely comes from a real Telegram user opening our
 * Web App — not a script POSTing a forged "I passed the captcha" claim.
 *
 * The check is Telegram's documented HMAC scheme: derive a secret key from
 * the bot token, recompute the hash over the sorted data-check-string, and
 * compare. A forged or tampered payload won't match, since only Telegram and
 * the bot's owner know the token. Also rejects stale payloads so a captured
 * initData can't be replayed indefinitely.
 *
 * Returns the authenticated user id on success, or null on any failure.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600
): { userId: number } | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // Constant-time compare to avoid leaking hash bytes via timing.
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    if (typeof user?.id === "number") return { userId: user.id };
  } catch {
    // fall through
  }
  return null;
}
