import { colorPaths, runsPath } from "@/lib/pixel-path";

// 15×15 PikaGold coin: the PikaMd cat's head (components/brand/pika-art.ts) embossed on a gold
// coin, in the logo's palette (ink outline, gold rim, recessed face, raised head with pointed ears
// lit from the top left with a drop shadow, peach inner ears and nose). Drawn from an ASCII map at
// an integer scale so every pixel stays crisp. Animations live in globals.css (.pg-*): a light
// stripe sweeps across in 2-pixel steps, then a pixel sparkle blinks on the rim.
const MAP = [
  ".....OOOOO.....",
  "...OOLLLLROO...",
  "..OLLRRRRRRSO..",
  ".OLRhFFFFFyRSO.",
  ".OLRhyFFFygRSO.",
  "OLRFhpyyypgFRSO",
  "OLRFhyyyyygFRSO",
  "OLRFykyyykgFRSO",
  "OLRFyyypyygFRSO",
  "OLRFFgyhygFFRSO",
  ".OLRFFgggFFRSO.",
  ".OLRFFFFFFFRSO.",
  "..OSRRRRRRSSO..",
  "...OOSSSSSOO...",
  ".....OOOOO.....",
];

const COLORS: Record<string, string> = {
  O: "#1A0800", // outline (--ink)
  L: "#FFE680", // rim light
  R: "#FFCB05", // rim (--y1)
  S: "#C47A00", // rim shade (--g3)
  F: "#E08A00", // recessed face (--g2)
  y: "#FFCB05", // raised head
  h: "#FFE680", // head light (top left)
  g: "#B86E00", // head shade and drop shadow
  k: "#1A0800", // eyes
  p: "#F2A08A", // inner ears and nose (same peach as the mascot)
};

const N = MAP.length;

// Horizontal runs of the same color, drawn as one path per color (lib/pixel-path.ts)
const RUNS: { x: number; y: number; w: number; fill: string }[] = [];
MAP.forEach((row, y) => {
  let x = 0;
  while (x < N) {
    const ch = row[x];
    let end = x + 1;
    while (end < N && row[end] === ch) end++;
    if (ch !== ".") RUNS.push({ x, y, w: end - x, fill: COLORS[ch] });
    x = end;
  }
});

// The shine is clipped to everything inside the outline
const INSIDE: { x: number; y: number; w: number }[] = MAP.map((row, y) => {
  const first = row.indexOf("O"), last = row.lastIndexOf("O");
  return { x: first + 1, y, w: last - first - 1 };
}).filter((r) => r.w > 0);

// "/" stripe two pixels wide (cells with x + y ∈ {0, 1}); CSS slides it right across the coin
const STRIPE = Array.from({ length: N }, (_, y) => ({ x: -y, y, w: 2 }));

const FACE = colorPaths(RUNS);
const INSIDE_D = runsPath(INSIDE);
const STRIPE_D = runsPath(STRIPE);

export default function PikaGoldCoin({ scale = 2, clipId }: { scale?: number; clipId: string }) {
  // useId output may hold characters that break url(#…)
  const id = `pg-${clipId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="pg-coin"
      width={N * scale}
      height={N * scale}
      viewBox={`0 0 ${N} ${N}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={id}>
          <path d={INSIDE_D} />
        </clipPath>
      </defs>
      {FACE.map(({ fill, d }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
      <g clipPath={`url(#${id})`}>
        <g className="pg-shine">
          <path d={STRIPE_D} />
        </g>
      </g>
      {/* Sparkle on the upper-right rim: a dot, then a plus, then a dot */}
      <g className="pg-spark pg-spark-dot">
        <rect x={11} y={2} width={1} height={1} />
      </g>
      <g className="pg-spark pg-spark-plus">
        <rect x={11} y={1} width={1} height={3} />
        <rect x={10} y={2} width={3} height={1} />
      </g>
    </svg>
  );
}
