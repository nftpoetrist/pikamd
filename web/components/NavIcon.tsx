import { colorPaths } from "@/lib/pixel-path";

// The navbar's icons. Shapes after Squeaksy's menu icons (the user's own game: small objects read at
// a glance, one outline, a glint), drawn in PikaMd's own icon language so they sit in the gold navbar
// (user requests 2026-11-10/11: "like Squeaksy's navbar icons", then "in tune with the navbar and the
// site, premium, not garish"): the embossed gold of components/PixelGlyph.tsx, lit top left, shaded
// bottom right, an ink outline, ink details and one cream glint.
// "#" = gold face (lit or shaded at its edges), "-" = ink detail inside the shape, "w" = glint.
// Colours come from CSS (globals.css → .nav-icon): --ni-face, --ni-light, --ni-shade, --ni-ink,
// --ni-glint; on gold buttons they turn a darker emboss.
const ICONS = {
  // Explore: a magnifier, dark glass with a glint in a gold ring, a gold handle
  explore: [
    "..#####....",
    ".#-----#...",
    "#--w----#..",
    "#-w-----#..",
    "#-------#..",
    "#-------#..",
    "#-------#..",
    ".#-----##..",
    "..#####.##.",
    "........###",
    ".........##",
  ],
  // My Collection: two guideline cards, the front one with a diamond
  collection: [
    "...#######.",
    "...#-----#.",
    "#######--#.",
    "#-----#--#.",
    "#--#--#--#.",
    "#-###-#--#.",
    "#--#--#--#.",
    "#-----#--#.",
    "#-----####.",
    "#-----#....",
    "#######....",
  ],
  // Connect your agent: the agent, a robot head with an antenna, two eyes and a mouth
  agent: [
    ".....w.....",
    ".....#.....",
    "..#######..",
    ".#-------#.",
    "##-#---#-##",
    "##-#---#-##",
    ".#-------#.",
    ".#--###--#.",
    ".#-------#.",
    "..#######..",
  ],
  // Publish: a page with a folded corner and a plus
  publish: [
    "######...",
    "#----##..",
    "#----#-#.",
    "#----####",
    "#---#---#",
    "#--###--#",
    "#---#---#",
    "#-------#",
    "#########",
  ],
  // Connect Wallet: a wallet with a card peeking out and a clasp
  wallet: [
    "..########..",
    ".#--------#.",
    "############",
    "#----------#",
    "#-------####",
    "#-------#w##",
    "#-------####",
    "#----------#",
    "############",
  ],
} as const;

export type NavIconName = keyof typeof ICONS;

const FACE = "var(--ni-face)";
const LIGHT = "var(--ni-light)";
const SHADE = "var(--ni-shade)";
const INK = "var(--ni-ink)";
const GLINT = "var(--ni-glint)";

/** One navbar icon at 2× (one path per colour, whole pixels only), outlined in ink. */
export default function NavIcon({ name, scale = 2 }: { name: NavIconName; scale?: number }) {
  const map = ICONS[name];
  const H = map.length;
  const W = map[0].length;
  const cell = (x: number, y: number) => map[y]?.[x] ?? ".";
  const on = (x: number, y: number) => cell(x, y) !== ".";
  const solid = (x: number, y: number) => cell(x, y) === "#" || cell(x, y) === "w";
  const rects: { x: number; y: number; fill: string }[] = [];
  for (let y = -1; y <= H; y++) {
    for (let x = -1; x <= W; x++) {
      const c = cell(x, y);
      if (c === "-") rects.push({ x, y, fill: INK });
      else if (c === "w") rects.push({ x, y, fill: GLINT });
      else if (c === "#") {
        let fill = FACE;
        if (!solid(x - 1, y) || !solid(x, y - 1)) fill = LIGHT;
        else if (!solid(x + 1, y) || !solid(x, y + 1)) fill = SHADE;
        rects.push({ x, y, fill });
      } else if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) {
        rects.push({ x, y, fill: INK });
      }
    }
  }
  return (
    <svg width={(W + 2) * scale} height={(H + 2) * scale} viewBox={`-1 -1 ${W + 2} ${H + 2}`} shapeRendering="crispEdges" aria-hidden="true">
      {colorPaths(rects).map(({ fill, d }) => (
        <path key={fill} d={d} style={{ fill }} />
      ))}
    </svg>
  );
}
