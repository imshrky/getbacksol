import "server-only";
import { Keypair } from "@solana/web3.js";

let cached: Keypair | null = null;

/**
 * Server-only: the platform's gasless fee-payer keypair. Holds a small
 * operational SOL float (network fees only, ~0.000005 SOL/signature) —
 * never user funds. Never import this from client code; the "server-only"
 * import above makes that a build error if attempted.
 */
export function getFeePayerKeypair(): Keypair {
  if (cached) return cached;

  const raw = process.env.FEE_PAYER_SECRET_KEY;
  if (!raw) {
    throw new Error("FEE_PAYER_SECRET_KEY is not configured.");
  }

  const secretKey = Uint8Array.from(JSON.parse(raw));
  cached = Keypair.fromSecretKey(secretKey);
  return cached;
}
