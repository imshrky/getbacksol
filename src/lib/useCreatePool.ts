"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import type { TxStatus } from "./useSimulatedTx";
import { FEE_WALLET } from "./feeWallet";
import { getCpmmProgramIds, pickStandardCpmmConfig, POOL_CREATION_FEE_LAMPORTS } from "./raydiumPool";
import { NETWORK } from "@/app/providers";

const LAMPORTS_PER_SOL = 1_000_000_000;
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export type CreatePoolParams = {
  tokenMint: string;
  tokenAmount: string; // UI amount, e.g. "500000" — converted to raw units using the mint's real decimals
  solAmount: string; // UI amount of SOL to pair against, e.g. "1.5"
};

export type CreatePoolResult = { status: TxStatus; message: string; poolId: string | null; run: (params: CreatePoolParams) => Promise<void> };

/**
 * Creates a real Raydium CPMM liquidity pool pairing the creator's own SPL
 * token with native SOL — fully client-built and client-signed, the same
 * "user pays for everything, no relay" pattern as useCreateToken.ts (there's
 * no gasless sponsorship here: the creator is providing real liquidity, so
 * they necessarily already hold the SOL and tokens involved). See
 * docs/RAYDIUM-POOL-TODO.md for the money model and docs/TOWER-TODO.md for
 * status — this is gated behind NEXT_PUBLIC_RAYDIUM_POOL_LIVE (default OFF)
 * in create-liquidity/page.tsx until it's been tested with real funds.
 *
 * Pool/vault/LP-mint addresses are PDAs Raydium derives from the mint pair +
 * fee config — no extra ephemeral keypair needs to co-sign, unlike token
 * creation's fresh mint account (verified by reading the SDK's own
 * createPool implementation, not just its type signatures).
 */
export function useCreatePool(): CreatePoolResult {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState("");
  const [poolId, setPoolId] = useState<string | null>(null);

  const run = useCallback(
    async (params: CreatePoolParams) => {
      if (!connected || !publicKey) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to create a pool.");
        return;
      }
      if (!signTransaction || !signAllTransactions) {
        setStatus("error");
        setMessage("This wallet doesn't support the signing methods needed.");
        return;
      }

      let tokenMintKey: PublicKey;
      try {
        tokenMintKey = new PublicKey(params.tokenMint.trim());
      } catch {
        setStatus("error");
        setMessage("Enter a valid token mint address.");
        return;
      }

      const tokenAmountNum = Number(params.tokenAmount);
      const solAmountNum = Number(params.solAmount);
      if (!(tokenAmountNum > 0) || !(solAmountNum > 0)) {
        setStatus("error");
        setMessage("Enter a positive amount for both sides of the pool.");
        return;
      }

      setStatus("pending");
      setMessage("");
      setPoolId(null);

      try {
        // Read the mint's real decimals and owning token program on-chain —
        // never trust client-supplied values for either, same principle as
        // build-sell's account validation.
        const mintInfo = await connection.getParsedAccountInfo(tokenMintKey);
        const parsed = mintInfo.value?.data as { parsed?: { type?: string; info?: { decimals?: number } } } | undefined;
        if (!mintInfo.value || parsed?.parsed?.type !== "mint" || typeof parsed.parsed.info?.decimals !== "number") {
          throw new Error("That address isn't a valid SPL token mint.");
        }
        const decimals = parsed.parsed.info.decimals;
        const tokenProgramId = mintInfo.value.owner.toBase58();

        const cluster = NETWORK === "devnet" ? "devnet" : "mainnet";
        const raydium = await Raydium.load({
          connection,
          owner: publicKey,
          cluster,
          signAllTransactions,
          disableLoadToken: true,
        });

        const configs = await raydium.api.getCpmmConfigs();
        const feeConfig = pickStandardCpmmConfig(configs);
        if (!feeConfig) throw new Error("Couldn't load Raydium's pool fee configuration. Try again shortly.");

        const { programId, poolFeeAccount } = getCpmmProgramIds(NETWORK);

        const mintAAmount = new BN(Math.round(tokenAmountNum * 10 ** decimals).toString());
        const mintBAmount = new BN(Math.round(solAmountNum * LAMPORTS_PER_SOL).toString());

        const { transaction, extInfo } = await raydium.cpmm.createPool({
          programId,
          poolFeeAccount,
          mintA: { address: tokenMintKey.toBase58(), decimals, programId: tokenProgramId },
          mintB: { address: WSOL_MINT, decimals: 9, programId: TOKEN_PROGRAM_ID.toBase58() },
          mintAAmount,
          mintBAmount,
          startTime: new BN(0),
          feeConfig,
          associatedOnly: true,
          ownerInfo: { useSOLBalance: true },
          txVersion: TxVersion.LEGACY,
        });

        // Our commission on top of Raydium's own protocol fee (already
        // included in `transaction` via poolFeeAccount) — a flat amount,
        // not a percentage, since there's no "amount reclaimed" here.
        if (POOL_CREATION_FEE_LAMPORTS > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: FEE_WALLET,
              lamports: POOL_CREATION_FEE_LAMPORTS,
            })
          );
        }

        transaction.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        const signed = await signTransaction(transaction as Transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

        const newPoolId = extInfo.address.poolId.toBase58();
        setStatus("success");
        setPoolId(newPoolId);
        setMessage(`Pool created! Pool ID: ${newPoolId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Pool creation failed.";
        if (/reject|declin|cancel/i.test(msg)) {
          setStatus("idle");
          setMessage("");
        } else {
          setStatus("error");
          setMessage(msg);
        }
      }
    },
    [connected, publicKey, signTransaction, signAllTransactions, connection]
  );

  return { status, message, poolId, run };
}
