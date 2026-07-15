import { ImageResponse } from "next/og";

export const alt = "GetBackSOL — Reclaim locked SOL from dormant Solana accounts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#e30613";
const INK = "#f5f5f7";
const MUTED = "#9a9aa3";
const BG = "#09090b";

const TEXT =
  "GetBackSOL Your SOL is trapped. Refund it. Reclaim locked SOL from dormant Solana token accounts — non-custodial, in seconds. getbacksol.com";

/**
 * Without an explicit font, Satori (next/og's renderer) falls back to its
 * own generic bundled sans-serif — not Poppins, the typeface the rest of
 * the site actually uses (see layout.tsx). Fetches the real Poppins glyphs
 * (both weights actually used below — Satori can only render weights it's
 * been given, so loading bold alone made the "regular" description text
 * render bold too) so the image matches the site instead of looking like a
 * different brand. `text` scopes the request to only the glyphs used here,
 * and the legacy user-agent is required to get a .ttf back — modern
 * browsers get woff2, which Satori can't parse.
 */
async function loadPoppins(weight: 400 | 700): Promise<ArrayBuffer> {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=Poppins:wght@${weight}&text=${encodeURIComponent(TEXT)}`,
      { headers: { "User-Agent": "Mozilla/4.0 (Windows 98; U)" } }
    )
  ).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error("Could not find a truetype font URL in the Google Fonts response.");
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

export default async function Image() {
  const [poppinsRegular, poppinsBold] = await Promise.all([loadPoppins(400), loadPoppins(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 80,
          fontFamily: "Poppins",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 7.5-2" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: INK }}>
            GetBack<span style={{ color: ACCENT }}>SOL</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: INK, lineHeight: 1.15, maxWidth: 920 }}>
            Your SOL is trapped. Refund it.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, maxWidth: 820 }}>
            Reclaim locked SOL from dormant Solana token accounts — non-custodial, in seconds.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: ACCENT }} />
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>getbacksol.com</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Poppins", data: poppinsRegular, weight: 400, style: "normal" },
        { name: "Poppins", data: poppinsBold, weight: 700, style: "normal" },
      ],
    }
  );
}
