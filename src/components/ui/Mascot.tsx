import type { SVGProps } from "react";

export type MascotExpression = "happy" | "wink" | "sleeping" | "sad" | "excited";

// The GetBackSOL mascot: the open padlock with a little face from the logo,
// with swappable expressions for different states (success, empty wallet,
// error, loading...). Stroke-based so it inherits `color` (defaults to
// currentColor), letting it sit white-on-red like the logo or take an accent
// tint inline. Pass `badge` to wrap it in the red rounded-square lockup.
export function Mascot({
  expression = "happy",
  badge = false,
  title,
  ...props
}: SVGProps<SVGSVGElement> & {
  expression?: MascotExpression;
  badge?: boolean;
  title?: string;
}) {
  const stroke = badge ? "#ffffff" : "currentColor";

  const face = (
    <>
      {/* Eyes */}
      {expression === "wink" ? (
        <>
          <circle cx="26" cy="39" r="2.4" fill={stroke} />
          <path d="M35 39h4.5" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
        </>
      ) : expression === "sleeping" ? (
        <>
          <path d="M23.5 39q2.5 2.4 5 0" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M35.5 39q2.5 2.4 5 0" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="26" cy="39" r="2.4" fill={stroke} />
          <circle cx="38" cy="39" r="2.4" fill={stroke} />
        </>
      )}

      {/* Mouth */}
      {expression === "sad" ? (
        <path d="M26 48q6-5 12 0" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
      ) : expression === "excited" ? (
        <path
          d="M27 44q5 6 10 0a6 6 0 0 1-10 0z"
          fill={stroke}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ) : expression === "sleeping" ? (
        <path d="M28 45q4 3 8 0" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
      ) : (
        <path d="M26 44q6 5 12 0" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
      )}

      {/* Sleepy z's */}
      {expression === "sleeping" && (
        <text x="45" y="24" fontSize="9" fontWeight="700" fill={stroke} fontFamily="sans-serif">
          z
        </text>
      )}
    </>
  );

  const lock = (
    <g
      fill="none"
      stroke={stroke}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Open shackle (right leg lifted = unlocked) */}
      <path d="M21 30V19a11 11 0 0 1 22 0v4.5" />
      {/* Lock body */}
      <rect x="16" y="30" width="32" height="24" rx="7" />
    </g>
  );

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title ?? `GetBackSOL mascot, ${expression}`} {...props}>
      {title ? <title>{title}</title> : null}
      {badge && <rect x="2" y="2" width="60" height="60" rx="14" fill="var(--accent, #e30613)" />}
      {lock}
      {face}
    </svg>
  );
}
