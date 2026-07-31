/**
 * Decorative split-screen panel for the auth pages.
 *
 * A stylised monstera arrangement drawn entirely in SVG and tinted with the
 * Reliant Anchor logo palette (deep navy #1C2E4C → azure #3080C0), so the
 * artwork stays on-brand and ships with no image payload.
 *
 * The leaf is built once in <defs>: a solid blade, with the fenestrations cut
 * out by a mask of rounded strokes, then re-used at several scales and tilts.
 */

const BLADE =
  "M0 262 C40 259 86 232 104 184 C121 140 112 72 66 32 C46 14 23 4 0 0 " +
  "C-23 4 -46 14 -66 32 C-112 72 -121 140 -104 184 C-86 232 -40 259 0 262 Z";

/** Edge slits — deliberately overshoot the blade, which clips them. */
const SLITS = [
  "M14 224 L150 196",
  "M14 186 L165 142",
  "M14 146 L155 82",
  "M14 106 L122 26",
  "M14 66 L78 -14",
  "M14 30 L44 -30",
];

/** Interior fenestrations: short slits on the same axis, between the long ones. */
const HOLES = [
  "M30 206 L66 199",
  "M32 166 L74 154",
  "M32 126 L72 108",
  "M30 86 L62 64",
];

const VEINS = [
  "M4 208 L128 186",
  "M4 168 L142 132",
  "M4 128 L132 74",
  "M4 88 L100 20",
];

/** base x, base y, tilt°, scale, blade gradient, stem tint, opacity — back to front */
const LEAVES: [number, number, number, number, string, string, number][] = [
  [170, 60, 165, 1.3, "ra-leaf-deep", "#16304f", 0.55],
  [-30, 430, 50, 1.5, "ra-leaf-deep", "#1a3a5f", 0.75],
  [760, 480, -65, 1.7, "ra-leaf-mid", "#1d4271", 0.9],
  [700, 1050, -25, 1.5, "ra-leaf-mid", "#1d4271", 0.85],
  [430, 900, -22, 1.85, "ra-leaf-bright", "#245c92", 1],
];

/** Renders the given paths, then the same set mirrored across the midrib. */
function Mirrored({ paths }: { paths: string[] }) {
  const half = paths.map((d) => <path key={d} d={d} />);
  return (
    <>
      {half}
      <g transform="scale(-1 1)">{half}</g>
    </>
  );
}

export function AuthFoliage({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="ra-bg" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#12243c" />
          <stop offset="50%" stopColor="#1a3358" />
          <stop offset="100%" stopColor="#0d1c30" />
        </linearGradient>
        <radialGradient id="ra-glow" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0%" stopColor="#3d8fd0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3d8fd0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ra-vignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1522" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#0a1522" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a1522" stopOpacity="0.45" />
        </linearGradient>

        <linearGradient id="ra-leaf-deep" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#2a4f7d" />
          <stop offset="100%" stopColor="#132b4a" />
        </linearGradient>
        <linearGradient id="ra-leaf-mid" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#3a72ac" />
          <stop offset="100%" stopColor="#1d4271" />
        </linearGradient>
        <linearGradient id="ra-leaf-bright" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#57a3dd" />
          <stop offset="100%" stopColor="#2a6ba8" />
        </linearGradient>

        <mask id="ra-cuts" maskUnits="userSpaceOnUse" x="-180" y="-60" width="360" height="440">
          <rect x="-180" y="-60" width="360" height="440" fill="#fff" />
          <g stroke="#000" strokeWidth="12" strokeLinecap="round" fill="none">
            <Mirrored paths={SLITS} />
          </g>
          <g stroke="#000" strokeWidth="9" strokeLinecap="round" fill="none">
            <Mirrored paths={HOLES} />
          </g>
        </mask>

        <clipPath id="ra-blade" clipPathUnits="userSpaceOnUse">
          <path d={BLADE} />
        </clipPath>

        <g id="ra-leaf">
          <path
            d="M0 258 C0 296 -8 324 -22 352"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <g mask="url(#ra-cuts)">
            <path d={BLADE} />
            <g
              clipPath="url(#ra-blade)"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.09"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <Mirrored paths={VEINS} />
            </g>
            <path
              d="M0 258 L0 6"
              clipPath="url(#ra-blade)"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.13"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </g>
      </defs>

      <rect width="720" height="1000" fill="url(#ra-bg)" />
      <ellipse cx="380" cy="450" rx="460" ry="440" fill="url(#ra-glow)" />

      {LEAVES.map(([bx, by, tilt, scale, gradient, tint, opacity]) => (
        <use
          key={`${bx}-${by}`}
          href="#ra-leaf"
          fill={`url(#${gradient})`}
          color={tint}
          opacity={opacity}
          transform={`translate(${bx} ${by}) rotate(${tilt}) scale(${scale}) translate(0 -262)`}
        />
      ))}

      <rect width="720" height="1000" fill="url(#ra-vignette)" />
    </svg>
  );
}
