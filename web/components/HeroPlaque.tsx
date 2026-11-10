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
  "--hp-cloud-bottom": tile(ISLAND.cloudBottomTile),
  "--hp-cloud-left": tile(ISLAND.cloudLeftTile),
  "--hp-cloud-right": tile(ISLAND.cloudRightTile),
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
 * Explore's title (user requests 2026-11-10: "the same without the cat, thinner, a soft sky white
 * like clouds", then "the frame is a cloud, not a straight line; a soft white background where the
 * text reads well"): the whole plaque is one cloud. A soft white body, puffs on every edge and big
 * puffs on the corners, the island's badges and divider with gold stars. 3px per art pixel.
 */
function CloudPlaque({ children }: { children: ReactNode }) {
  const mid = "round(down, 50% - 6.5 * var(--a), 1px)";
  return (
    <div className="hero-plaque is-cloud" style={CLOUD_TILES}>
      <div className="hp-island" aria-hidden="true">
        <span className="hp-panel" />
        <span className="hp-cloud-left" />
        <span className="hp-cloud-right" />
        <span className="hp-cloud-top" />
        <span className="hp-cloud-bottom" />
        <Sprite s={ISLAND.cloudCornerTL} at={{ x: left(-8), y: top(-10) }} />
        <Sprite s={ISLAND.cloudCornerTR} at={{ x: right(10), y: top(-10) }} />
        <Sprite s={ISLAND.cloudCornerBL} at={{ x: left(-8), y: below(-7) }} />
        <Sprite s={ISLAND.cloudCornerBR} at={{ x: right(10), y: below(-7) }} />
        <Sprite s={ISLAND.cloudGem} className="hp-gem" at={{ x: left(-6), y: mid }} />
        <Sprite s={ISLAND.cloudGem} className="hp-gem" at={{ x: right(7), y: mid }} />
      </div>
      {children}
    </div>
  );
}

const LIBRARY_TILES = { "--hp-star": tile(ISLAND.bookGlyph) } as CSSProperties;
const AI_TILES = { "--hp-star": tile(ISLAND.nodeGlyph) } as CSSProperties;

/**
 * My Collection's title (user request 2026-11-10: "a library, in tune with the site, not crude:
 * aesthetic, beautiful, premium"): a walnut panel in a thin wooden frame with a gold inlay, two
 * small clusters of books on the shelf (the home cards' colours), a shelf plank on gold brackets,
 * gold corner caps and an open-book glyph on the divider. 3px per art pixel.
 */
function LibraryPlaque({ children }: { children: ReactNode }) {
  return (
    <div className="hero-plaque is-library" style={LIBRARY_TILES}>
      <div className="hp-island" aria-hidden="true">
        <span className="hp-shelf-top" />
        <span className="hp-panel" />
        <span className="hp-inlay" />
        <span className="hp-shelf" />
        <Sprite s={ISLAND.booksLeft} at={{ x: left(4), y: top(-17) }} />
        <Sprite s={ISLAND.booksRight} at={{ x: right(4 + ISLAND.booksRight.w), y: top(-17) }} />
        <Sprite s={ISLAND.bracket} className="hp-bracket" at={{ x: "round(down, 16%, 1px)", y: below(4) }} />
        <Sprite s={ISLAND.bracket} className="hp-bracket hp-flip-x" at={{ x: "round(down, 84% - 6 * var(--a), 1px)", y: below(4) }} />
        <Sprite s={ISLAND.cornerCap} at={{ x: left(1), y: top(1) }} />
        <Sprite s={ISLAND.cornerCap} className="hp-flip-x" at={{ x: right(5), y: top(1) }} />
        <Sprite s={ISLAND.cornerCap} className="hp-flip-y" at={{ x: left(1), y: below(-5) }} />
        <Sprite s={ISLAND.cornerCap} className="hp-flip-xy" at={{ x: right(5), y: below(-5) }} />
      </div>
      {children}
    </div>
  );
}

/**
 * Connect's title (user request 2026-11-10: "an AI-like background, premium, minimalist"): a
 * microchip. A dark board with a faint dot grid and a soft blue glow, a thin gold chip outline
 * with cut corners and an inner hairline, the pin-1 dot, gold pins along the top and bottom,
 * circuit traces to solder pads on both sides, HUD corner marks, a node on the divider.
 */
function AiPlaque({ children }: { children: ReactNode }) {
  const mid = "round(down, 50% - 12.5 * var(--a), 1px)";
  return (
    <div className="hero-plaque is-ai" style={AI_TILES}>
      <div className="hp-island" aria-hidden="true">
        <span className="hp-pins hp-pins-top" />
        <span className="hp-pins hp-pins-bottom" />
        <span className="hp-chip-edge" />
        <span className="hp-panel" />
        <span className="hp-chip-inner" />
        <span className="hp-pin1" />
        <Sprite s={ISLAND.tracesLeft} className="hp-traces" at={{ x: left(-18), y: mid }} />
        <Sprite s={ISLAND.tracesRight} className="hp-traces" at={{ x: right(0), y: mid }} />
        <Sprite s={ISLAND.hudMark} at={{ x: left(-7), y: top(-7) }} />
        <Sprite s={ISLAND.hudMark} className="hp-flip-x" at={{ x: right(-3), y: top(-7) }} />
        <Sprite s={ISLAND.hudMark} className="hp-flip-y" at={{ x: left(-7), y: below(3) }} />
        <Sprite s={ISLAND.hudMark} className="hp-flip-xy" at={{ x: right(-3), y: below(3) }} />
      </div>
      {children}
    </div>
  );
}

export default function HeroPlaque({ children, variant = "island" }: { children: ReactNode; variant?: "island" | "cloud" | "library" | "ai" }) {
  if (variant === "cloud") return <CloudPlaque>{children}</CloudPlaque>;
  if (variant === "library") return <LibraryPlaque>{children}</LibraryPlaque>;
  if (variant === "ai") return <AiPlaque>{children}</AiPlaque>;
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
