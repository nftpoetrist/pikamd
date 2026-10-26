import { mergeRuns } from "@/lib/pixel-path";

// 16×16 pixel coin with a "0" on its face. Drawn from an ASCII map; the rim gets a
// light bevel on the top-left and a dark bevel on the bottom-right, like the navbar buttons.
const COIN = [
  ".....######.....",
  "...##......##...",
  "..#..........#..",
  ".#............#.",
  ".#............#.",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  ".#............#.",
  ".#............#.",
  "..#..........#..",
  "...##......##...",
  ".....######.....",
];

// The "0" on the face (cols 6–9, rows 4–11)
const DIGIT: [number, number][] = [
  [7, 4], [8, 4],
  [6, 5], [9, 5], [6, 6], [9, 6], [6, 7], [9, 7], [6, 8], [9, 8], [6, 9], [9, 9], [6, 10], [9, 10],
  [7, 11], [8, 11],
];

const INK = "#1A0800";
const GOLD = "#FFCB05";
const LIGHT = "#FFE680";
const SHADE = "#C47A00";

export default function PixelCoin({ size = 128 }: { size?: number }) {
  const N = COIN.length;
  const isEdge = (x: number, y: number) => COIN[y]?.[x] === "#";
  // Inside = between the left and right edge on the same row
  const inside = (x: number, y: number) => {
    const row = COIN[y];
    if (!row) return false;
    const left = row.indexOf("#"), right = row.lastIndexOf("#");
    return x > left && x < right && !isEdge(x, y);
  };
  const digit = new Set(DIGIT.map(([x, y]) => `${x},${y}`));

  const rects: { x: number; y: number; fill: string }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (isEdge(x, y)) rects.push({ x, y, fill: INK });
      else if (inside(x, y)) {
        let fill = GOLD;
        if (digit.has(`${x},${y}`)) fill = INK;
        else if (isEdge(x - 1, y) || isEdge(x, y - 1)) fill = LIGHT;
        else if (isEdge(x + 1, y) || isEdge(x, y + 1)) fill = SHADE;
        rects.push({ x, y, fill });
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" aria-hidden="true">
      {/* Rects, not one path per color: drawn at 56px (3.5× a 16px map), a path would get soft edges */}
      {mergeRuns(rects).map(({ x, y, w, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={fill} />
      ))}
    </svg>
  );
}
