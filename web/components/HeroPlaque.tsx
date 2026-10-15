import type { CSSProperties, ReactNode } from "react";

// Ornate title plaque behind the home hero (user request 2026-10-15): a dark espresso glass panel
// in a double gold frame, shaped as a pixel cartouche (a raised crest on top, a pendant below,
// concave scoops on the sides, stepped rounded corners), with a faceted gem on the crest, gold
// filigree swashes beside it, gold beads in the scoops and a sparkle on the pendant. Purely
// decorative (aria-hidden) and drawn outside the text's box, so the text keeps its layout.
// Ornament maps: design/brand/plaque-ornaments.mjs. Every curve steps in 3px pixels.

const STEP = 3;

type Shape = { crest: number; crestHalf: number; pendant: number; pendantHalf: number; corner: number; scoop: number };

/**
 * The cartouche outline as a CSS polygon(). Coordinates mix px and % through calc(), so one polygon
 * fits any box; every curve is a staircase of 3px steps (crisp, like the rest of the pixel UI).
 */
function cartouche({ crest, crestHalf, pendant, pendantHalf, corner, scoop }: Shape): string {
  const pts: [string, string][] = [];
  const add = (x: string, y: string) => {
    const last = pts[pts.length - 1];
    if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
  };
  const px = (v: number) => `${v}px`;
  const R = (v: number) => `calc(100% - ${v}px)`;
  const C = (v: number) => (v === 0 ? "50%" : `calc(50% ${v < 0 ? "-" : "+"} ${Math.abs(v)}px)`);
  const qz = (v: number) => Math.round(v / STEP) * STEP;
  // Half-widths of a stepped half-ellipse bump, one per 3px of height (widest at the base)
  const bump = (height: number, half: number) => {
    const out: number[] = [];
    for (let h = 0; h < height; h += STEP) {
      const t = (h + STEP / 2) / height;
      out.push(qz(half * Math.sqrt(Math.max(1 - t * t, 0))));
    }
    return out;
  };
  // Stepped quarter circle: offsets from a corner, top edge first
  const quarter = (r: number) => {
    const out: [number, number][] = [];
    for (let y = 0; y < r; y += STEP) {
      const cy = r - (y + STEP / 2);
      const x = qz(r - Math.sqrt(Math.max(r * r - cy * cy, 0)));
      out.push([x, y], [x, y + STEP]);
    }
    return out;
  };
  const crestRows = bump(crest, crestHalf);
  const pendRows = bump(pendant, pendantHalf);
  const qc = quarter(corner);
  const scoopPts: [number, number][] = [];
  for (let d = -scoop; d < scoop; d += STEP) {
    const mid = d + STEP / 2;
    const depth = qz(Math.sqrt(Math.max(scoop * scoop - mid * mid, 0)));
    scoopPts.push([depth, d], [depth, d + STEP]);
  }

  // Top edge with the crest (left to right)
  add(px(corner), px(crest));
  crestRows.forEach((half, i) => { add(C(-half), px(crest - i * STEP)); add(C(-half), px(crest - (i + 1) * STEP)); });
  [...crestRows].reverse().forEach((half, j) => { const i = crestRows.length - 1 - j; add(C(half), px(crest - (i + 1) * STEP)); add(C(half), px(crest - i * STEP)); });
  // Top-right corner, right side with its scoop, bottom-right corner
  for (const [dx, dy] of qc) add(R(dx), px(crest + dy));
  add(R(0), C(-scoop));
  for (const [depth, d] of scoopPts) add(R(depth), C(d));
  add(R(0), C(scoop));
  for (const [dx, dy] of [...qc].reverse()) add(R(dx), R(pendant + dy));
  // Bottom edge with the pendant (right to left)
  pendRows.forEach((half, i) => { add(C(half), R(pendant - i * STEP)); add(C(half), R(pendant - (i + 1) * STEP)); });
  [...pendRows].reverse().forEach((half, j) => { const i = pendRows.length - 1 - j; add(C(-half), R(pendant - (i + 1) * STEP)); add(C(-half), R(pendant - i * STEP)); });
  // Bottom-left corner, left side with its scoop, top-left corner
  for (const [dx, dy] of qc) add(px(dx), R(pendant + dy));
  add(px(0), C(scoop));
  for (const [depth, d] of [...scoopPts].reverse()) add(px(depth), C(d));
  add(px(0), C(-scoop));
  for (const [dx, dy] of [...qc].reverse()) add(px(dx), px(crest + dy));
  return `polygon(${pts.map(([x, y]) => `${x} ${y}`).join(", ")})`;
}

// Frame layers, outside in: ink silhouette, gold rim, dark gap, thin gold inlay, glass fill.
// Each one sits `inset` px inside the last and keeps the same shape (corners shrink with it).
const LAYERS = [
  ["ink", 0],
  ["rim", 3],
  ["gap", 6],
  ["inlay", 8],
  ["fill", 9],
] as const;

const WIDE: Shape = { crest: 18, crestHalf: 96, pendant: 12, pendantHalf: 54, corner: 18, scoop: 30 };
const NARROW: Shape = { crest: 12, crestHalf: 48, pendant: 9, pendantHalf: 30, corner: 12, scoop: 18 };
const shapeAt = (s: Shape, inset: number): Shape => ({
  ...s,
  crestHalf: s.crestHalf - inset,
  pendantHalf: s.pendantHalf - inset,
  corner: Math.max(s.corner - inset, STEP),
});

// Both outlines per layer as custom properties; globals.css picks one per screen width
const FRAME_VARS = Object.fromEntries(
  LAYERS.flatMap(([name, inset]) => [
    [`--hp-${name}`, cartouche(shapeAt(WIDE, inset))],
    [`--hp-${name}-sm`, cartouche(shapeAt(NARROW, inset))],
  ]),
) as CSSProperties;

// ── Ornaments (one letter per pixel) ─────────────────────────────────────────────────────
const PALETTE: Record<string, string> = {
  O: "#1A0800", // outline (--ink)
  W: "#FFFFFF", // glint
  c: "#FFF1C2", // gem, light facets
  m: "#E9D9B4", // gem, mid facets
  d: "#BFAE86", // gem, shade facet
  h: "#FFE680", // gold light
  Y: "#FFCB05", // gold (--y1)
  s: "#C47A00", // gold shade (--g3)
};

/** Cushion-cut gem in a gold setting, on the crest. */
const GEM = [
  "......O......",
  "....OOhOO....",
  "...OhhWYYO...",
  "..OhWWWccYO..",
  ".OhWWWWcccYO.",
  "OhccccWmmmmsO",
  ".OYmmmmdddsO.",
  "..OYmmmddsO..",
  "...OYYmssO...",
  "....OOsOO....",
  "......O......",
];

/** Round gold bead, one in each side scoop. */
const BEAD = [
  "...OOO...",
  "..OhhhO..",
  ".OhWhYYO.",
  "OhhhWYYsO",
  "OhhWWYssO",
  "OhYYYsssO",
  ".OYYsssO.",
  "..OsssO..",
  "...OOO...",
];

/** Four-point sparkle, on the pendant. */
const SPARKLE = [
  ".....O.....",
  "....OhO....",
  "....OhO....",
  "...OhhYO...",
  ".OOhhWYYOO.",
  "OhhhWWWYYYO",
  ".OOYYWYYOO.",
  "...OYYYO...",
  "....OYO....",
  "....OYO....",
  ".....O.....",
];

/** Filigree swash beside the crest (right-hand; the left one is mirrored in CSS). */
const SWASH = [
  "........................OO....",
  "......................OOhhOO..",
  "......OOOOOOO........OhhhhhhO.",
  "...OOOYYYYYYhOOO.....OhOOOOhO.",
  "OOOYYYYYYYYhhhhhOOO..OhO..OhO.",
  "YYYYYOOOOOOOOOhhhhhOO.O...OhO.",
  "YYYOO.........OOOhhhhOO..OOhO.",
  "OOO..............OOhhhhOOhhO..",
  "...................OOhhhhhO...",
  ".....................OOOOO....",
];

function Pixels({ map, scale, className }: { map: readonly string[]; scale: number; className: string }) {
  const w = map[0].length, h = map.length;
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") rects.push({ x, y, w: end - x, fill: PALETTE[ch] });
      x = end;
    }
  });
  return (
    <svg className={className} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges">
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

// Each ornament at 3× (wide screens) and 2× (phones): integer scales only, so pixels stay crisp
function Ornament({ map, className }: { map: readonly string[]; className: string }) {
  return (
    <i className={`hp-orn ${className}`}>
      <Pixels map={map} scale={3} className="hp-x3" />
      <Pixels map={map} scale={2} className="hp-x2" />
    </i>
  );
}

export default function HeroPlaque({ children }: { children: ReactNode }) {
  return (
    <div className="hero-plaque">
      <span className="hp-frame" style={FRAME_VARS} aria-hidden="true">
        {LAYERS.map(([name]) => (
          <span key={name} className={`hp-layer hp-${name}`} />
        ))}
        <Ornament map={SWASH} className="hp-swash hp-swash-l" />
        <Ornament map={SWASH} className="hp-swash hp-swash-r" />
        <Ornament map={GEM} className="hp-gem" />
        <Ornament map={BEAD} className="hp-bead hp-bead-l" />
        <Ornament map={BEAD} className="hp-bead hp-bead-r" />
        <Ornament map={SPARKLE} className="hp-spark" />
      </span>
      {children}
    </div>
  );
}
