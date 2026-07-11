import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";

// Mirrors the NETWORK fallback in src/app/providers.tsx — duplicated (rather
// than imported) because providers.tsx is a "use client" module and can't be
// imported from a server route.
const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

type TokenMeta = {
  symbol: string | null;
  name: string | null;
};

const EMPTY_META: TokenMeta = { symbol: null, name: null };

function findMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );
  return pda;
}

function readBorshString(buf: Buffer, offset: number): { value: string; next: number } {
  const len = buf.readUInt32LE(offset);
  const raw = buf.subarray(offset + 4, offset + 4 + len);
  // Metaplex pads name/symbol/uri with trailing null bytes to a fixed max length.
  const value = raw.toString("utf8").replace(/\0/g, "").trim();
  return { value, next: offset + 4 + len };
}

/** Parses the fixed-layout prefix of a Metaplex Token Metadata account. */
function parseMetadataAccount(data: Buffer): TokenMeta {
  // 1 byte key + 32 bytes updateAuthority + 32 bytes mint
  let offset = 1 + 32 + 32;
  const name = readBorshString(data, offset);
  offset = name.next;
  const symbol = readBorshString(data, offset);
  return { name: name.value || null, symbol: symbol.value || null };
}

/**
 * Resolves a token's name/symbol by reading its Metaplex Token Metadata
 * account directly on-chain — free (reuses our existing Helius RPC quota),
 * no third-party API key needed. Falls back to nulls (UI shows the
 * shortened mint address) for tokens without standard metadata.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(address);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
  const connection = new Connection(endpoint);

  try {
    const pda = findMetadataPda(mint);
    const account = await connection.getAccountInfo(pda, { commitment: "confirmed" });
    if (!account) {
      return NextResponse.json(EMPTY_META, { headers: { "Cache-Control": "public, max-age=3600" } });
    }

    const meta = parseMetadataAccount(account.data);
    return NextResponse.json(meta, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json(EMPTY_META);
  }
}
