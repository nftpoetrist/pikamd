import { PIKA, PIKA_LIDS, PIKA_PALETTE } from "@/components/brand/pika-art";
import { colorPaths } from "@/lib/pixel-path";

// The PikaMd cat (components/brand/pika-art.ts) as crisp SVG: one path per color (lib/pixel-path.ts),
// at an integer scale so every pixel stays sharp. `blink`: the eyes close for a
// moment every few seconds (globals.css → .pika-lids; off with prefers-reduced-motion).

const N = PIKA.length;

const RUNS: { x: number; y: number; w: number; fill: string }[] = [];
PIKA.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    const ch = row[x];
    let end = x + 1;
    while (end < row.length && row[end] === ch) end++;
    if (ch !== ".") RUNS.push({ x, y, w: end - x, fill: PIKA_PALETTE[ch] });
    x = end;
  }
});

const BODY = colorPaths(RUNS);
const LIDS = colorPaths(PIKA_LIDS.map(({ x, y, c }) => ({ x, y, fill: PIKA_PALETTE[c] })));

export default function PikaSprite({ scale = 1, blink = false, className }: { scale?: number; blink?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width={N * scale}
      height={N * scale}
      viewBox={`0 0 ${N} ${N}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {BODY.map(({ fill, d }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
      {blink && (
        <g className="pika-lids">
          {LIDS.map(({ fill, d }) => (
            <path key={fill} d={d} fill={fill} />
          ))}
        </g>
      )}
    </svg>
  );
}
