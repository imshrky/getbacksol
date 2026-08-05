import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB is plenty for a token logo

/**
 * Uploads a token's logo and its Metaplex metadata JSON to IPFS via Pinata,
 * and returns the metadata URI the on-chain CreateMetadataAccountV3
 * instruction points at (see tokenMetadata.ts). The token itself is created
 * and signed entirely client-side (see useCreateToken); this route only
 * handles the off-chain hosting, which needs a secret Pinata key that can't
 * live in the browser.
 *
 * Requires PINATA_JWT — without it the whole feature stays inert (503).
 */
export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: "Token metadata hosting is not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { image, name, symbol, description } = body ?? {};
  if (typeof image !== "string" || typeof name !== "string" || typeof symbol !== "string") {
    return NextResponse.json({ error: "Missing token details." }, { status: 400 });
  }

  // image is a data URL: data:image/png;base64,....
  const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  }
  const contentType = match[1];
  const imageBuffer = Buffer.from(match[2], "base64");
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is empty or too large (max 5 MB)." }, { status: 400 });
  }

  try {
    // 1. Pin the image.
    const ext = contentType.split("/")[1] ?? "png";
    const form = new FormData();
    form.append("file", new Blob([imageBuffer], { type: contentType }), `${symbol || "token"}.${ext}`);
    const imgRes = await fetch(PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!imgRes.ok) throw new Error("image pin failed");
    const imgJson = await imgRes.json();
    const imageUri = `${GATEWAY}${imgJson.IpfsHash}`;

    // 2. Pin the metadata JSON that points at the image.
    const metadata = {
      name,
      symbol,
      description: typeof description === "string" ? description : "",
      image: imageUri,
    };
    const jsonRes = await fetch(PIN_JSON_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pinataContent: metadata }),
    });
    if (!jsonRes.ok) throw new Error("metadata pin failed");
    const jsonJson = await jsonRes.json();
    const metadataUri = `${GATEWAY}${jsonJson.IpfsHash}`;

    return NextResponse.json({ metadataUri, imageUri });
  } catch {
    return NextResponse.json({ error: "Couldn't upload token metadata. Try again." }, { status: 502 });
  }
}
