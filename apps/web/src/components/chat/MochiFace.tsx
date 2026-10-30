export type MochiStatus =
  | "idle"
  | "thinking"
  | "tool"
  | "speaking"
  | "celebrate"
  | "error";

/** Static clay-style SVG face for Mochi. Used in the FAB and as the 3D fallback. */
export default function MochiFace({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Mochi"
      style={{ display: "block", flex: "none" }}
    >
      {/* sprout */}
      <path d="M50 22 C 50 14, 52 10, 56 6" fill="none" stroke="#46364a" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="42" cy="12" rx="9" ry="6" fill="#7fd8a6" stroke="#46364a" strokeWidth="3" transform="rotate(-24 42 12)" />
      <ellipse cx="60" cy="9" rx="8" ry="5.5" fill="#7fd8a6" stroke="#46364a" strokeWidth="3" transform="rotate(20 60 9)" />
      {/* body */}
      <path
        d="M50 24 C 74 24, 88 42, 88 62 C 88 82, 72 94, 50 94 C 28 94, 12 82, 12 62 C 12 42, 26 24, 50 24 Z"
        fill="#ffb59d"
        stroke="#46364a"
        strokeWidth="3.5"
      />
      {/* cheeks */}
      <ellipse cx="28" cy="66" rx="7" ry="4.5" fill="#ff8f78" opacity="0.75" />
      <ellipse cx="72" cy="66" rx="7" ry="4.5" fill="#ff8f78" opacity="0.75" />
      {/* eyes */}
      <ellipse cx="37" cy="56" rx="4" ry="5.5" fill="#46364a" />
      <ellipse cx="63" cy="56" rx="4" ry="5.5" fill="#46364a" />
      <circle cx="38.5" cy="53.5" r="1.4" fill="#fff" />
      <circle cx="64.5" cy="53.5" r="1.4" fill="#fff" />
      {/* mouth */}
      <path d="M43 68 Q 50 75, 57 68" fill="none" stroke="#46364a" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
