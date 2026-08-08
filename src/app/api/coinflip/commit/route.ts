import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { generateServerSeed, hashServerSeed } from "@/lib/coinflip";

/**
 * Starts a new round: generates a secret server seed, commits to it by
 * storing/returning only its hash, and creates the round row the resolve
 * step will fill in. The seed itself never leaves the server until after
 * the round resolves — that's what makes the later reveal meaningful.
 */
export async function POST() {
  const serverSeed = generateServerSeed();
  const commitHash = hashServerSeed(serverSeed);

  try {
    const sql = getSql();
    const rows = await sql`
      INSERT INTO coinflip_rounds (commit_hash, server_seed)
      VALUES (${commitHash}, ${serverSeed})
      RETURNING id
    `;
    return NextResponse.json({ roundId: rows[0].id, commitHash });
  } catch {
    return NextResponse.json({ error: "Couldn't start a new round. Try again shortly." }, { status: 503 });
  }
}
