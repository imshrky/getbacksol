import "server-only";

/**
 * Minimal partner registry for API v1 — a small env-var-configured map
 * rather than a database, since there are zero real partners signed up
 * yet. `PARTNER_API_KEYS` is a JSON object: {"partner-slug": "api-key"}.
 * Revisit with a real store (and per-partner rate limiting) once there's
 * an actual partner making real requests — building that infrastructure
 * before there's a single partner to use it would be premature.
 */
function getPartnerKeys(): Record<string, string> {
  const raw = process.env.PARTNER_API_KEYS;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Returns the partner's slug/id if `apiKey` is valid, otherwise null. */
export function resolvePartner(apiKey: string | null): string | null {
  if (!apiKey) return null;
  const partners = getPartnerKeys();
  for (const [partnerId, key] of Object.entries(partners)) {
    if (key === apiKey) return partnerId;
  }
  return null;
}
