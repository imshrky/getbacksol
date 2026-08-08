import "server-only";
import { Keypair } from "@solana/web3.js";
import { FEE_WALLET } from "./feeWallet";

let cached: Keypair | null = null;

/**
 * Server-only: FEE_WALLET's own signing key, needed only for the Coinflip
 * game's automatic payouts (every other feature on this site only ever
 * sends money *to* FEE_WALLET, which never requires its private key). This
 * is a deliberate, significant escalation from the rest of the app: FEE_WALLET
 * holds the platform's entire accumulated fee revenue, and this key now
 * lets server code move it automatically. Set FEE_WALLET_SECRET_KEY
 * yourself (Vercel env var / .env.local) — never pasted through an AI
 * session, same handling as FEE_PAYER_SECRET_KEY.
 *
 * Verifies the configured key's public half actually matches FEE_WALLET on
 * every cold start — a mismatch here would mean bets get collected at one
 * address but payouts silently fail (or worse, come from the wrong
 * wallet), so this fails loudly instead.
 */
export function getFeeWalletKeypair(): Keypair {
  if (cached) return cached;

  const raw = process.env.FEE_WALLET_SECRET_KEY;
  if (!raw) {
    throw new Error("FEE_WALLET_SECRET_KEY is not configured.");
  }

  const secretKey = Uint8Array.from(JSON.parse(raw));
  const keypair = Keypair.fromSecretKey(secretKey);

  if (!keypair.publicKey.equals(FEE_WALLET)) {
    throw new Error(
      `FEE_WALLET_SECRET_KEY does not match FEE_WALLET (expected ${FEE_WALLET.toBase58()}, got ${keypair.publicKey.toBase58()}).`
    );
  }

  cached = keypair;
  return cached;
}
