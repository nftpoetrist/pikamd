import type { CSSProperties, ReactNode } from "react";
import { ISLAND, type IslandSprite } from "@/components/brand/island-art";
import { colorPaths } from "@/lib/pixel-path";

// The home title's background (user request 2026-11-10: "exactly like this image, nothing more,
// nothing less"): a floating grass island. A dark panel in a thin gold frame, a mossy grass band on
// top with a step down near the right end, the PikaMd cat peeking over it with two yellow marks,
// an open book in a gold orbit, daisies and tufts, a gold badge on each side line, and under the
// panel a band of dirt bricks over a dark underside with tufts and stalactites at the ends. The
// divider between the title and the subtitle is drawn by CSS (globals.css, .hero-sub::before).
// Every size, place and color comes from the reference (design/brand/hero-island.mjs); one art
// pixel is --a (4px, 2px on phones). Decorative (aria-hidden) and drawn around the text's box, so
// the text keeps its own layout.

type Box = { x: string; y: string };
const a = (n: number) => `${n} * var(--a)`;

/** One sprite as crisp SVG (one path per color), sized and placed in art pixels. `cell`: art
 * pixels per map cell (the orbit is drawn on a half-pixel grid so its line stays thin). */
function Sprite({ s, at, className, cell = 1 }: { s: IslandSprite; at: Box; className?: string; cell?: number }) {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") runs.push({ x, y, w: end - x, fill: s.palette[ch] });
      x = end;
    }
  });
  const style: CSSProperties = { left: at.x, top: at.y, width: `calc(${a(s.w * cell)})`, height: `calc(${a(s.h * cell)})` };
  return (
    <svg className={`hp-sprite ${className ?? ""}`} style={style} viewBox={`0 0 ${s.w} ${s.h}`} shapeRendering="crispEdges" aria-hidden="true">
      {colorPaths(runs).map(({ fill, d }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
}

/** A sprite as a CSS background image (for the repeating middles of the grass and the underside). */
function tile(s: IslandSprite): string {
  const rects = s.rows
    .flatMap((row, y) => [...row].map((ch, x) => (ch === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${s.palette[ch]}"/>`)))
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const TILES = {
  "--hp-grass-hi": tile(ISLAND.grassHiTile),
  "--hp-grass-lo": tile(ISLAND.grassLoTile),
  "--hp-under": tile(ISLAND.underTile),
  "--hp-star": tile(ISLAND.star),
  "--hp-star-s": tile(ISLAND.starSmall),
} as CSSProperties;

const CLOUD_TILES = {
  "--hp-cloud-top": tile(ISLAND.cloudTopTile),
  "--hp-cloud-under": tile(ISLAND.cloudUnderTile),
  "--hp-star": tile(ISLAND.cloudStar),
  "--hp-star-s": tile(ISLAND.cloudStarSmall),
} as CSSProperties;

// Places, in art pixels from the panel's top-left (the frame's top line); "c" from the centre,
// "r" from the right edge. Whole pixels only (round), so sprites never sit between screen pixels.
const left = (n: number) => `calc(${a(n)})`;
const center = (n: number) => `round(down, 50% + ${a(n)}, 1px)`;
const right = (n: number) => `round(down, 100% - ${a(n)}, 1px)`;
const top = (n: number) => `calc(${a(n)})`;
const below = (n: number) => `calc(100% + ${a(n)})`; // from the panel's bottom edge

/**
 * Explore's title (user request 2026-11-10: "the same without the cat, thinner, a soft sky white
 * like clouds"): the island's frame, badges and divider in soft white over a night-blue panel
 * (the Arc sea's blues), cloud puffs along the top and a puffy cloud underside. 3px per art pixel.
 */
function CloudPlaque({ children }: { children: ReactNode }) {
  return (
    <div className="hero-plaque is-cloud" style={CLOUD_TILES}>
      <div className="hp-island" aria-hidden="true">
        <span className="hp-panel" />
        <span className="hp-line hp-line-l" />
        <span className="hp-line hp-line-r" />
        <span className="hp-line hp-line-b" />
        <span className="hp-cloud-under" />
        <Sprite s={ISLAND.cloudUnderLeft} at={{ x: left(-8), y: below(0) }} />
        <Sprite s={ISLAND.cloudUnderRight} at={{ x: right(6), y: below(0) }} />
        <span className="hp-cloud-top" />
        <Sprite s={ISLAND.cloudTopLeft} at={{ x: left(-8), y: top(-10) }} />
        <Sprite s={ISLAND.cloudTopRight} at={{ x: right(6), y: top(-10) }} />
        <Sprite s={ISLAND.cloudGem} className="hp-gem" at={{ x: left(-6), y: "round(down, 50% - 6.5 * var(--a), 1px)" }} />
        <Sprite s={ISLAND.cloudGem} className="hp-gem" at={{ x: right(7), y: "round(down, 50% - 6.5 * var(--a), 1px)" }} />
      </div>
      {children}
    </div>
  );
}

export default function HeroPlaque({ children, variant = "island" }: { children: ReactNode; variant?: "island" | "cloud" }) {
  if (variant === "cloud") return <CloudPlaque>{children}</CloudPlaque>;
  return (
    <div className="hero-plaque" style={TILES}>
      <div className="hp-island" aria-hidden="true">
        {/* The orbit's far half and the dark mound sit behind everything else */}
        <Sprite s={ISLAND.orbitBack} className="hp-orbit" cell={0.5} at={{ x: right(74), y: top(-34.5) }} />
        <Sprite s={ISLAND.mound} at={{ x: center(-23), y: top(-18) }} />

        {/* Panel: dark fill and the thin gold frame (its top line hides under the grass) */}
        <span className="hp-panel" />
        <span className="hp-line hp-line-l" />
        <span className="hp-line hp-line-r" />
        <span className="hp-line hp-line-b" />
        <Sprite s={ISLAND.frameTL} at={{ x: "0px", y: top(-5) }} />
        <Sprite s={ISLAND.frameTR} at={{ x: right(9), y: "0px" }} />

        {/* Under the panel: the grass strip, the brick band and the dark underside */}
        <span className="hp-under" />
        <Sprite s={ISLAND.underLeft} at={{ x: left(-11), y: below(-14) }} />
        <Sprite s={ISLAND.underRight} at={{ x: right(40), y: below(-14) }} />
        <Sprite s={ISLAND.hole} at={{ x: center(47), y: below(13) }} />
        <Sprite s={ISLAND.dropBig} at={{ x: center(-18), y: below(19) }} />
        <Sprite s={ISLAND.dropSmall} at={{ x: center(39), y: below(19) }} />

        {/* Top grass: high band, the step down, the lower band */}
        <span className="hp-grass">
          <Sprite s={ISLAND.grassHiLeft} at={{ x: "0px", y: "0px" }} />
          <span className="hp-grass-hi" />
          <Sprite s={ISLAND.grassStep} className="hp-grass-step" at={{ x: right(41), y: "0px" }} />
          <span className="hp-grass-lo" />
          <Sprite s={ISLAND.grassLoRight} at={{ x: right(6), y: top(4) }} />
        </span>

        {/* On the grass: tufts, daisies, the cat and its marks */}
        <Sprite s={ISLAND.tuft} at={{ x: left(57), y: top(-13) }} />
        <Sprite s={ISLAND.tuft} at={{ x: center(-46), y: top(-13) }} />
        <Sprite s={ISLAND.tuft} at={{ x: right(44), y: top(-9) }} />
        <Sprite s={ISLAND.tuft} at={{ x: right(20), y: top(-9) }} />
        <Sprite s={ISLAND.flower} className="hp-flower-l" at={{ x: left(44), y: top(-18) }} />
        <Sprite s={ISLAND.flower} at={{ x: center(-33), y: top(-17) }} />
        <Sprite s={ISLAND.flower} at={{ x: right(35), y: top(-13) }} />
        <Sprite s={ISLAND.cat} className="hp-cat" at={{ x: center(-19), y: top(-39) }} />
        <Sprite s={ISLAND.mark} className="hp-mark" at={{ x: center(13), y: top(-50) }} />

        {/* The book in its orbit, top right */}
        <Sprite s={ISLAND.book} className="hp-book" at={{ x: right(62), y: top(-38) }} />
        <Sprite s={ISLAND.orbitFront} className="hp-orbit" cell={0.5} at={{ x: right(74), y: top(-34.5) }} />

        {/* Gold badges on the side lines */}
        <Sprite s={ISLAND.gem} className="hp-gem" at={{ x: left(-6), y: top(17) }} />
        <Sprite s={ISLAND.gem} className="hp-gem" at={{ x: right(7), y: top(17) }} />
      </div>
      {children}
    </div>
  );
}
