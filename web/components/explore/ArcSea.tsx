// A pixel sea behind Explore's cards, edge to edge down to the footer (user request 2026-10-26:
// Arc blues, waves that move pixel by pixel, light on the page). The tiles are SVGs drawn here
// from periodic height profiles, so they repeat seamlessly; CSS slides each layer by exactly one
// tile with steps(), one art pixel per step. Only transform animates: the compositor moves three
// layers, nothing is repainted, no JavaScript runs after render. The water itself is a static
// stepped gradient (.arc-sea-water).
//
// Layers: the surface (a crest row with its own water, along the top edge), then two layers of
// thin foam lines over the whole sea, a row every 48px each, offset by 24px and drifting in
// opposite directions, so every gap between the cards shows moving water.

const P = 3; // one art pixel in CSS px, the same as the title plaque's ornaments

// The site's Arc blues: the Arc card (002, .tcg-navy) and the blue cat (components/brand/run-cat.ts)
const SURFACE = { width: 64, rows: 8, body: "#2E4183", foam: "#6A86D8", lit: "#8FAAF0", cap: "#EEF2FF" };
const FOAM = [
  { width: 64, phase: 0.6, line: "#4E66B8", cap: "#8FAAF0" },
  { width: 80, phase: 2.3, line: "#3A54A0", cap: "#6A86D8" },
] as const;
const FOAM_ROWS = 16; // a foam tile is 16 art px tall: one line, the rest open water

const svgUrl = (w: number, h: number, rects: string[]) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${rects.join("")}</svg>`)}")`;
const px = (x: number, y: number, fill: string, h = 1) => `<rect x="${x}" y="${y}" width="1" height="${h}" fill="${fill}"/>`;

/** Heights per column from two sines whose periods divide the tile, so the tile repeats seamlessly. */
function profile(width: number, phase: number, lo: number, hi: number): number[] {
  return Array.from({ length: width }, (_, x) => {
    const t = (2 * Math.PI * x) / width;
    const v = 0.5 + 0.32 * Math.sin(t + phase) + 0.18 * Math.sin(3 * t + 2 * phase); // 0..1
    return Math.max(lo, Math.min(hi, Math.round(lo + v * (hi - lo))));
  });
}

// The surface: crest line, light on the rising side, white caps on the high peaks, water below
function surfaceTile(): string {
  const { width, rows, body, foam, lit, cap } = SURFACE;
  const h = profile(width, 0, 1, rows - 1);
  const rects: string[] = [];
  for (let x = 0; x < width; x++) {
    const top = rows - h[x];
    const prev = h[(x - 1 + width) % width];
    const next = h[(x + 1) % width];
    rects.push(px(x, top, body, rows - top));
    rects.push(px(x, top, h[x] >= prev && h[x] > next && h[x] >= 5 ? cap : foam));
    if (h[x] > prev && top + 1 < rows) rects.push(px(x, top + 1, lit));
  }
  return svgUrl(width, rows, rects);
}

// A foam line: one pixel thick, rising and falling over 3 rows, a brighter pixel on each crest
function foamTile(f: (typeof FOAM)[number]): string {
  const h = profile(f.width, f.phase, 0, 3);
  const rects: string[] = [];
  for (let x = 0; x < f.width; x++) {
    const prev = h[(x - 1 + f.width) % f.width];
    const next = h[(x + 1) % f.width];
    const y = 4 - h[x];
    // Breaks in the line, so it reads as many small waves rather than one rope
    if ((x + Math.round(f.phase * 10)) % 21 > 17) continue;
    rects.push(px(x, y, h[x] >= prev && h[x] > next && h[x] === 3 ? f.cap : f.line));
  }
  return svgUrl(f.width, FOAM_ROWS, rects);
}

const SURFACE_TILE = surfaceTile();
const FOAM_TILES = FOAM.map(foamTile);

/** Decorative; sits under the cards (z-index 0 inside .arc-sea). */
export default function ArcSea() {
  const tile = (w: number) => `${w * P}px`;
  return (
    <div className="arc-sea-water" aria-hidden="true">
      {FOAM.map((f, i) => (
        <div key={i} className={`arc-sea-foam arc-sea-foam-${i}`}>
          <div
            className="arc-sea-roll"
            style={{
              backgroundImage: FOAM_TILES[i],
              backgroundSize: `${tile(f.width)} ${FOAM_ROWS * P}px`,
              width: `calc(100% + ${tile(f.width)})`,
              marginLeft: `-${tile(f.width)}`,
              animationDuration: `${[16, 24][i]}s`, // 250ms and 300ms a step: on the lanes' 50ms clock
              animationTimingFunction: `steps(${f.width})`,
              ["--sea-tile" as string]: tile(f.width),
            }}
          />
        </div>
      ))}
      <div className="arc-sea-surface">
        <div
          className="arc-sea-roll"
          style={{
            backgroundImage: `${SURFACE_TILE}, linear-gradient(${SURFACE.body}, ${SURFACE.body})`,
            backgroundSize: `${tile(SURFACE.width)} ${SURFACE.rows * P}px, 100% 100%`,
            backgroundPosition: `0 0, 0 ${SURFACE.rows * P}px`,
            backgroundRepeat: "repeat-x, no-repeat",
            width: `calc(100% + ${tile(SURFACE.width)})`,
            marginLeft: `-${tile(SURFACE.width)}`,
            animationDuration: "12.8s", // 200ms a step: on the lanes' 50ms clock
            animationTimingFunction: `steps(${SURFACE.width})`,
            ["--sea-tile" as string]: tile(SURFACE.width),
          }}
        />
      </div>
    </div>
  );
}
