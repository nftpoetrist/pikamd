import { colorPaths } from "@/lib/pixel-path";

// The navbar's icons (user request 2026-11-10: "like the buttons in Squeaksy's navbar, each icon
// fitting its button"). Squeaksy's language (the user's own game, src/page/pixelIcons.ts): small
// maps at 2×, one dark outline, flat fills with a white glint and a gold accent, objects you read at
// a glance. Redrawn in PikaMd's colours: ink outline, Arc blue, emerald, violet, gold.
// k ink outline · b blue · l light blue · w white · g gold · G light gold · o gold shade
// e emerald · E light emerald · p violet · P light violet · s silver · S light silver
const PAL: Record<string, string> = {
  k: "#1a0800",
  b: "#4a74d8",
  l: "#a9c4ff",
  w: "#ffffff",
  g: "#ffcb05",
  G: "#fff1a8",
  o: "#c47a00",
  e: "#2fa478",
  E: "#8be8bd",
  p: "#7a5cc4",
  P: "#b9a5f0",
  s: "#a9b6cc",
  S: "#eef3fb",
};

const ICONS = {
  // Explore: a magnifier, blue glass with a glint, gold handle
  explore: [
    "..kkkkk......",
    ".kwwllbk.....",
    "kwllllbbk....",
    "kwllllbbk....",
    "kllllbbbk....",
    "klllbbbbk....",
    ".kbbbbbk.....",
    "..kkkkkgk....",
    "......kGgk...",
    ".......kGgk..",
    "........kGgk.",
    ".........kok.",
    "..........k..",
  ],
  // My Collection: a stack of guideline cards, the front one white with a gold diamond
  collection: [
    ".kkkkkkkk...",
    "kbbbbbbbbk..",
    "kbwwwwwwbkk.",
    "kbwwwgwwbkEk",
    "kbwwgGgwbkek",
    "kbwgGggobkek",
    "kbwwgggwbkek",
    "kbwwwowwbkek",
    "kbllllllbkek",
    "kbbbbbbbbkek",
    ".kkkkkkkkkek",
    "..keeeeeeeek",
    "...kkkkkkkk.",
  ],
  // Connect your agent: the agent, a robot head with a gold antenna and violet ears
  agent: [
    "......k......",
    ".....kGk.....",
    "......g......",
    "......k......",
    "..kkkkkkkkk..",
    ".kSSSSSSSSsk.",
    "kkSwbSSSwbskk",
    "kpSbbSSSbbskP",
    "kkSSSSSSSSskk",
    ".kSSkgggkSsk.",
    ".kssssssssskk",
    "..kkkkkkkkk..",
  ],
  // Publish: a page with a folded corner and a blue plus
  publish: [
    "kkkkkkk...",
    "kwwwwwkk..",
    "kwwwwwkGk.",
    "kwwwwwkkkk",
    "kwwwbwwwwk",
    "kwwbbbwwwk",
    "kwwwbwwwwk",
    "kwwwwwwwwk",
    "kwlllllwwk",
    "kkkkkkkkkk",
  ],
  // Connect Wallet: a blue wallet with a card peeking out and a gold clasp
  wallet: [
    "...kkkkkkk...",
    "..kwwwwwwwk..",
    "kkkkkkkkkkkkk",
    "kbbbbbbbbbbbk",
    "kbllllllllkkk",
    "kbbbbbbbbkGgk",
    "kbbbbbbbbkgok",
    "kbbbbbbbbbkkk",
    "kbbbbbbbbbbbk",
    ".kkkkkkkkkkk.",
  ],
} as const;

export type NavIconName = keyof typeof ICONS;

/** One navbar icon at 2× (crisp: one path per colour on whole pixels). */
export default function NavIcon({ name, scale = 2 }: { name: NavIconName; scale?: number }) {
  const map = ICONS[name];
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") runs.push({ x, y, w: end - x, fill: PAL[ch] });
      x = end;
    }
  });
  const w = map[0].length;
  const h = map.length;
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {colorPaths(runs).map(({ fill, d }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
}
