import "server-only";
import crypto from "crypto";
import OAuth from "oauth-1.0a";

const TWEETS_URL = "https://api.x.com/2/tweets";

function getOAuth() {
  const apiKey = process.env.X_API_KEY;
  const apiKeySecret = process.env.X_API_KEY_SECRET;
  if (!apiKey || !apiKeySecret) {
    throw new Error("X_API_KEY / X_API_KEY_SECRET are not configured.");
  }

  return new OAuth({
    consumer: { key: apiKey, secret: apiKeySecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

function getToken() {
  const key = process.env.X_ACCESS_TOKEN;
  const secret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!key || !secret) {
    throw new Error("X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET are not configured.");
  }
  return { key, secret };
}

/**
 * Posts a tweet (or a reply, if `replyToId` is given) as the account
 * identified by X_ACCESS_TOKEN. OAuth 1.0a user-context signing — required
 * for write access; the app-only Bearer token can't post on a user's behalf.
 */
export async function postTweet(text: string, replyToId?: string): Promise<{ id: string }> {
  const oauth = getOAuth();
  const token = getToken();

  const requestData = { url: TWEETS_URL, method: "POST" as const };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const body: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  const res = await fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`X API error (${res.status}): ${errBody}`);
  }

  const json = await res.json();
  return { id: json?.data?.id };
}

/**
 * Searches recent tweets (last 7 days) matching `query`, using app-only
 * Bearer auth — read-only, no posting capability, so no OAuth 1.0a signing
 * needed here. `startTime` (ISO 8601) scopes the search to a time window —
 * see auto-reply/route.ts for why that's the whole de-duplication strategy.
 */
export async function searchRecentTweets(query: string, maxResults = 10, startTime?: string) {
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) throw new Error("X_BEARER_TOKEN is not configured.");

  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("tweet.fields", "author_id,created_at");
  if (startTime) url.searchParams.set("start_time", startTime);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`X API error (${res.status}): ${errBody}`);
  }

  const json = await res.json();
  return (json?.data ?? []) as { id: string; text: string; author_id: string }[];
}
