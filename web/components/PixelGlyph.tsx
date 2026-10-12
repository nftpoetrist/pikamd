// Small pixel icons drawn from ASCII maps, same bevel and outline language as the coin, heart and Arc logo.
// "#" = face pixel (lit top-left edge, shaded bottom-right edge), "-" = ink detail inside the shape.
// Colors come from CSS: --glyph-face, --glyph-light, --glyph-shade, --glyph-ink.
const GLYPHS = {
  // A Markdown file with a folded corner and text lines
  file: [
    "#####...",
    "####-#..",
    "####-##.",
    "####----",
    "########",
    "#-----##",
    "########",
    "#----###",
    "########",
    "########",
  ],
  // A collection slot with a plus
  collect: [
    "#########",
    "#########",
    "####-####",
    "####-####",
    "##-----##",
    "####-####",
    "####-####",
    "#########",
    "#########",
  ],
  // A plug: the one-time MCP connection
  plug: [
    "..#...#..",
    "..#...#..",
    "..#...#..",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    "....#....",
  ],
  // A shield with a check: your agent stays safe
  shield: [
    "#########",
    "#########",
    "######-##",
    "#####-###",
    "#-##-####",
    "##--#####",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
  ],
} as const;

export type GlyphName = keyof typeof GLYPHS;

export default function PixelGlyph({ name, scale = 5 }: { name: GlyphName; scale?: number }) {
  const map = GLYPHS[name];
  const H = map.length, W = map[0].length;
  const cell = (x: number, y: number) => map[y]?.[x] ?? ".";
  const on = (x: number, y: number) => cell(x, y) !== ".";
  const rects: { x: number; y: number; c: string }[] = [];

  for (let y = -1; y <= H; y++) {
    for (let x = -1; x <= W; x++) {
      if (cell(x, y) === "-") {
        rects.push({ x, y, c: "var(--glyph-ink)" });
      } else if (on(x, y)) {
        let c = "var(--glyph-face)";
        if (!on(x - 1, y) || !on(x, y - 1)) c = "var(--glyph-light)";
        else if (!on(x + 1, y) || !on(x, y + 1)) c = "var(--glyph-shade)";
        rects.push({ x, y, c });
      } else if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) {
        rects.push({ x, y, c: "var(--glyph-ink)" });
      }
    }
  }

  return (
    <svg width={(W + 2) * scale} height={(H + 2) * scale} viewBox={`-1 -1 ${W + 2} ${H + 2}`} shapeRendering="crispEdges" aria-hidden="true">
      {rects.map(({ x, y, c }, i) => (
        <rect key={i} x={x} y={y} width={1} height={1} style={{ fill: c }} />
      ))}
    </svg>
  );
}
