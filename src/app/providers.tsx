"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

// NETWORK / RPC endpoint are read from env so switching devnet -> mainnet-beta
// (and pointing at a paid production RPC provider) is a Vercel env var change,
// not a code change. See docs/backend-architecture.md before setting
// NEXT_PUBLIC_SOLANA_NETWORK to mainnet-beta in production — the public RPC
// fallback used when NEXT_PUBLIC_SOLANA_RPC_URL is unset is rate-limited and
// not suitable for real traffic.
export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);

export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => RPC_ENDPOINT, []);
  // Wallet Standard auto-registers installed wallets (Phantom, Solflare, Backpack, etc.)
  // so no explicit adapter list is required here.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
