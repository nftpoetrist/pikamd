// Card 004 art: the PikaMd page (left) wired through a plug to an agent's head (right), with gold
// data pixels running along the cable. Our own pixel art in the X header icons' language
// (design/brand/social-icons.mjs: same page and robot palettes, bevel and ink outline), drawn
// smaller so it sits at the other cards' 3px pixel scale. No third-party logos (ARCHITECTURE K23).

const W = 40;
const H = 18;
const CABLE_Y = 11;
const CABLE_FROM = 12; // first cable cell, right of the page's outline
const CABLE_TO = 23; // last cable cell, left of the robot's ear outline

const PALETTE: Record<string, string> = {
  O: "#1A0800", k: "#1A0800", W: "#FFFFFF",
  c: "#FFF8E7", X: "#FFF1D6", x: "#E9D9B4", l: "#B08A4A", f: "#D8C49A", // page
  Y: "#FFCB05", B: "#FFCB05", s: "#C47A00", C: "#FFCB05", // gold
  a: "#E6EEFF", A: "#9FB3E6", r: "#3B5199", // sky-silver robot and plug
};

function scene(): string[][] {
  const g = Array.from({ length: H }, () => Array<string>(W).fill("."));
  const fill = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
  };

  // Page: 11×16 with a folded top-right corner
  fill(1, 1, 11, 16, "p");
  for (const [x, y] of [[9, 1], [10, 1], [11, 1], [10, 2], [11, 2], [11, 3]]) g[y][x] = ".";

  // Robot head: 13×11 with cut corners, ears, an antenna and a gold bulb
  fill(25, 6, 37, 16, "R");
  for (const [x, y] of [[25, 6], [37, 6], [25, 16], [37, 16]]) g[y][x] = ".";
  fill(24, 9, 24, 12, "R");
  fill(38, 9, 38, 12, "R");
  fill(31, 3, 31, 5, "R");

  // Plug on the cable: 3×5 body with two prongs toward the robot
  fill(17, 9, 19, 13, "P");
  g[10][20] = "P";
  g[12][20] = "P";

  // Bevel: light top-left edge, dark bottom-right edge, like the coin, heart and blocks
  const shaded = g.map((row) => [...row]);
  const bevel = (fillCode: string, light: string, mid: string, dark: string) => {
    const inside = (x: number, y: number) => g[y]?.[x] === fillCode;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (g[y][x] !== fillCode) continue;
        shaded[y][x] = !inside(x, y - 1) || !inside(x - 1, y) ? light : !inside(x, y + 1) || !inside(x + 1, y) ? dark : mid;
      }
  };
  bevel("p", "c", "X", "x");
  bevel("R", "a", "A", "r");
  bevel("P", "a", "A", "r");

  // Page details: the fold, a gold heading and text lines
  for (const [x, y] of [[9, 2], [9, 3], [10, 3]]) shaded[y][x] = "f";
  fill2(shaded, 3, 4, 6, 4, "Y");
  fill2(shaded, 3, 7, 9, 7, "l");
  fill2(shaded, 3, 10, 8, 10, "l");
  fill2(shaded, 3, 13, 9, 13, "l");

  // Robot details: bulb, eyes with a glint, mouth grill
  fill2(shaded, 30, 1, 32, 2, "B");
  shaded[1][30] = "W";
  shaded[2][32] = "s";
  fill2(shaded, 27, 9, 29, 10, "k");
  fill2(shaded, 33, 9, 35, 10, "k");
  shaded[9][27] = "W";
  shaded[9][33] = "W";
  for (let x = 28; x <= 34; x++) shaded[13][x] = x % 2 ? "O" : "a";

  // Cable: one gold row between the page and the plug, and the plug and the ear
  for (let x = CABLE_FROM; x <= CABLE_TO; x++) if (shaded[CABLE_Y][x] === ".") shaded[CABLE_Y][x] = "C";

  // Ink outline around every shape
  const solid = (x: number, y: number) => {
    const c = shaded[y]?.[x];
    return c !== undefined && c !== "." && c !== "O";
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (shaded[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(x + dx, y + dy))) g[y][x] = "@";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "@") shaded[y][x] = "O";
  return shaded;
}

function fill2(g: string[][], x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
}

const SCENE = scene();

export default function PixelAgents({ scale = 3 }: { scale?: number }) {
  // The two data pixels are HTML boxes over the picture, not SVG rects: a transform on an SVG
  // element isn't composited, so every step repainted all of the scene's rects on the main thread.
  // As boxes they move on the compositor and the scene is painted once.
  const pulse = { left: CABLE_FROM * scale, top: CABLE_Y * scale, width: scale, height: scale };
  return (
    <span className="pixel-agents" style={{ width: W * scale, height: H * scale, ["--agents-px" as string]: `${scale}px` }}>
      <svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" aria-hidden="true">
        {SCENE.flatMap((row, y) =>
          row.map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} style={{ fill: PALETTE[c] }} />)),
        )}
      </svg>
      {/* Data running from the page to the agent: white pixels stepping along the gold cable */}
      <span className="tcg-pulse" style={pulse} aria-hidden="true" />
      <span className="tcg-pulse tcg-pulse-late" style={pulse} aria-hidden="true" />
    </span>
  );
}
