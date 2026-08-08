import { Cluster, PublicKey } from "@solana/web3.js";
import {
  CREATE_CPMM_POOL_FEE_ACC,
  CREATE_CPMM_POOL_PROGRAM,
  DEVNET_PROGRAM_ID,
  type ApiCpmmConfigInfo,
} from "@raydium-io/raydium-sdk-v2";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Our commission on top of Raydium's own protocol fee (paid separately, to
// poolFeeAccount, as part of the createPool instruction itself — currently
// 0.15 SOL, read live from getStandardCpmmConfig below rather than assumed).
// A flat SOL amount rather than a percentage: unlike Reclaim/Sell, there's
// no "amount reclaimed" to take a cut of here, just liquidity the creator is
// choosing to add.
export const POOL_CREATION_FEE_LAMPORTS = Math.round(0.1 * LAMPORTS_PER_SOL);

// Raydium's own protocol fee for creating a CPMM pool, paid to
// poolFeeAccount as part of the createPool instruction itself — not ours,
// and not something we charge. Read live from getCpmmConfigs() at request
// time (see pickStandardCpmmConfig below); this constant only exists for
// showing an accurate cost preview before that call happens, confirmed
// against a real response (createPoolFee: "150000000" lamports) rather than
// assumed.
export const RAYDIUM_PROTOCOL_FEE_SOL = 0.15;

/** CPMM program + fee-account addresses differ between mainnet and devnet. */
export function getCpmmProgramIds(network: Cluster): { programId: PublicKey; poolFeeAccount: PublicKey } {
  if (network === "devnet") {
    return {
      programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    };
  }
  return { programId: CREATE_CPMM_POOL_PROGRAM, poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC };
}

/**
 * The "Standard" CPMM fee tier (index 0, 0.25% trade fee, confirmed against
 * the real getCpmmConfigs() response) — the same default Raydium's own UI
 * pre-selects for a new pool, out of ~19 tiers their API returns (most
 * reserved for other products' custom fee arrangements, not appropriate for
 * a general-purpose pool creator). Picking one specific, well-known tier
 * rather than exposing fee-tier selection keeps the UI — and the trust
 * assumptions — simple.
 */
export function pickStandardCpmmConfig(configs: ApiCpmmConfigInfo[]): ApiCpmmConfigInfo | null {
  return configs.find((c) => c.index === 0) ?? null;
}
