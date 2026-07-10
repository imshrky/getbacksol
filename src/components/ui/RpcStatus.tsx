"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { NETWORK } from "@/app/providers";

type RpcState = "checking" | "operational" | "degraded" | "down";

const CHECK_INTERVAL_MS = 30_000;
const DEGRADED_THRESHOLD_MS = 1500;

/**
 * Pings the actual configured Solana RPC endpoint (getVersion) and reports
 * its real, current latency — no simulated or hardcoded uptime numbers.
 */
export function RpcStatus() {
  const { connection } = useConnection();
  const [state, setState] = useState<RpcState>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const start = performance.now();
      try {
        await connection.getVersion();
        if (cancelled) return;
        const ms = Math.round(performance.now() - start);
        setLatency(ms);
        setState(ms > DEGRADED_THRESHOLD_MS ? "degraded" : "operational");
      } catch {
        if (!cancelled) {
          setLatency(null);
          setState("down");
        }
      }
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connection]);

  const config: Record<RpcState, { label: string; dot: string }> = {
    checking: { label: `Checking Solana ${NETWORK} RPC…`, dot: "bg-[var(--muted)]" },
    operational: {
      label: `Solana ${NETWORK} RPC: operational${latency !== null ? ` · ${latency}ms` : ""}`,
      dot: "bg-emerald-500",
    },
    degraded: {
      label: `Solana ${NETWORK} RPC: slow${latency !== null ? ` · ${latency}ms` : ""}`,
      dot: "bg-amber-500",
    },
    down: { label: `Solana ${NETWORK} RPC: unreachable`, dot: "bg-red-500" },
  };

  const c = config[state];

  return (
    <span className="pill inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
