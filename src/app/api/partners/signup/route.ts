import { NextRequest, NextResponse } from "next/server";
import { signUpPartner } from "@/lib/partners";

/**
 * Self-service partner signup. Issues an API key immediately — see
 * partners.ts for the anti-abuse measures this relies on instead of manual
 * review (per-IP daily cap, input validation, read-only key scope).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  try {
    const result = await signUpPartner(
      {
        name: body.name,
        email: body.email,
        website: body.website,
        payoutWallet: body.payoutWallet,
      },
      ip
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      partnerId: result.partnerId,
      apiKey: result.apiKey,
      revenueShare: result.revenueShare,
    });
  } catch {
    return NextResponse.json(
      { error: "Partner signup is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
