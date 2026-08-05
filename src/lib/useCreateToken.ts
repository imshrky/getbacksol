"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  AuthorityType,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { TxStatus } from "./useSimulatedTx";
import { FEE_WALLET } from "./feeWallet";
import { createMetadataInstruction } from "./tokenMetadata";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Platform fee for creating a token, in SOL. Config-driven so it can be tuned
// without a code change; the page reads the same constants for its cost line.
export const CREATE_BASE_FEE_SOL = Number(process.env.NEXT_PUBLIC_TOKEN_CREATE_FEE ?? "0.2");
export const REVOKE_FEE_SOL = Number(process.env.NEXT_PUBLIC_TOKEN_REVOKE_FEE ?? "0.1");

export type CreateTokenParams = {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description: string;
  imageDataUrl: string | null;
  revokeFreeze: boolean;
  revokeMint: boolean;
};

/**
 * Real SPL token creation, fully client-signed. Builds one transaction that
 * creates the mint, mints the whole supply to the creator, attaches Metaplex
 * metadata (name/symbol/logo, hosted via /api/upload-token-metadata), and
 * optionally revokes the freeze/mint authorities — plus the platform fee. The
 * creator is the payer and mint authority; the fresh mint keypair co-signs as
 * the new account. Same { status, message, run } shape as useSimulatedTx.
 */
export function useCreateToken() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [message, setMessage] = useState("");
  const [mintAddress, setMintAddress] = useState<string | null>(null);

  const run = useCallback(
    async (params: CreateTokenParams) => {
      if (!connected || !publicKey) {
        setStatus("needs-wallet");
        setMessage("Connect a wallet to create a token.");
        return;
      }
      if (!signTransaction) {
        setStatus("error");
        setMessage("This wallet doesn't support the signing method needed.");
        return;
      }

      const supplyNum = Number(params.supply);
      if (!params.name.trim() || !params.symbol.trim() || !(supplyNum > 0)) {
        setStatus("error");
        setMessage("Name, symbol and a positive supply are required.");
        return;
      }

      setStatus("pending");
      setMessage("");
      setMintAddress(null);

      try {
        // 1. Host the logo + metadata JSON on IPFS (only if an image was given).
        let uri = "";
        if (params.imageDataUrl) {
          const res = await fetch("/api/upload-token-metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: params.imageDataUrl,
              name: params.name,
              symbol: params.symbol,
              description: params.description,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.error || "Couldn't upload the token image.");
          uri = body.metadataUri;
        }

        // 2. Build the creation transaction.
        const mint = Keypair.generate();
        const rentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
        const ata = getAssociatedTokenAddressSync(mint.publicKey, publicKey);
        const amount = BigInt(Math.trunc(supplyNum)) * 10n ** BigInt(params.decimals);

        const tx = new Transaction();
        tx.add(
          SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports: rentLamports,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(mint.publicKey, params.decimals, publicKey, publicKey),
          createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, mint.publicKey),
          createMintToInstruction(mint.publicKey, ata, publicKey, amount)
        );

        if (uri) {
          tx.add(
            createMetadataInstruction({
              mint: mint.publicKey,
              mintAuthority: publicKey,
              payer: publicKey,
              updateAuthority: publicKey,
              name: params.name,
              symbol: params.symbol,
              uri,
              isMutable: true,
            })
          );
        }

        // Revoke authorities AFTER minting/metadata, since those need them.
        if (params.revokeFreeze) {
          tx.add(createSetAuthorityInstruction(mint.publicKey, publicKey, AuthorityType.FreezeAccount, null));
        }
        if (params.revokeMint) {
          tx.add(createSetAuthorityInstruction(mint.publicKey, publicKey, AuthorityType.MintTokens, null));
        }

        const feeSol =
          CREATE_BASE_FEE_SOL +
          (params.revokeFreeze ? REVOKE_FEE_SOL : 0) +
          (params.revokeMint ? REVOKE_FEE_SOL : 0);
        const feeLamports = Math.round(feeSol * LAMPORTS_PER_SOL);
        if (feeLamports > 0) {
          tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: FEE_WALLET, lamports: feeLamports }));
        }

        tx.feePayer = publicKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.partialSign(mint); // the new mint account authorizes its own creation

        const signed = await signTransaction(tx);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

        setStatus("success");
        setMintAddress(mint.publicKey.toBase58());
        setMessage(`Token created! Mint address: ${mint.publicKey.toBase58()}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Token creation failed.";
        if (/reject|declin|cancel/i.test(msg)) {
          setStatus("idle");
          setMessage("");
        } else {
          setStatus("error");
          setMessage(msg);
        }
      }
    },
    [connected, publicKey, signTransaction, connection]
  );

  return { status, message, mintAddress, run };
}
