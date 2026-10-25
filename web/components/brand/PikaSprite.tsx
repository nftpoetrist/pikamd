import { PIKA, PIKA_LIDS, PIKA_PALETTE } from "@/components/brand/pika-art";

// The PikaMd cat (components/brand/pika-art.ts) as crisp SVG: one rect per horizontal run of
// the same color, at an integer scale so every pixel stays sharp. `blink`: the eyes close for a
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

const LIDS = PIKA_LIDS.map(({ x, y, c }) => ({ x, y, fill: PIKA_PALETTE[c] }));

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
      {RUNS.map(({ x, y, w, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={fill} />
      ))}
      {blink && (
        <g className="pika-lids">
          {LIDS.map(({ x, y, fill }) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
          ))}
        </g>
      )}
    </svg>
  );
}
