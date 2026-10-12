// 9×8 pixel heart with the same bevel and outline language as the coin and Arc logo.
const HEART = [
  ".##...##.",
  "####.####",
  "#########",
  "#########",
  ".#######.",
  "..#####..",
  "...###...",
  "....#....",
];

export default function PixelHeart({ scale = 6 }: { scale?: number }) {
  const H = HEART.length, W = HEART[0].length;
  const on = (x: number, y: number) => HEART[y]?.[x] === "#";
  const rects: { x: number; y: number; c: string }[] = [];

  for (let y = -1; y <= H; y++) {
    for (let x = -1; x <= W; x++) {
      if (on(x, y)) {
        let c = "var(--heart-face)";
        if (!on(x - 1, y) || !on(x, y - 1)) c = "var(--heart-light)";
        else if (!on(x + 1, y) || !on(x, y + 1)) c = "var(--heart-shade)";
        rects.push({ x, y, c });
      } else if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) {
        rects.push({ x, y, c: "var(--heart-ink)" });
      }
    }
  }
  // Classic 8-bit shine: a 2-pixel highlight on the upper-left lobe
  rects.push({ x: 1, y: 1, c: "#FFFFFF" }, { x: 1, y: 2, c: "#FFFFFF" });

  return (
    <svg width={(W + 2) * scale} height={(H + 2) * scale} viewBox={`-1 -1 ${W + 2} ${H + 2}`} shapeRendering="crispEdges" aria-hidden="true">
      {rects.map(({ x, y, c }, i) => (
        <rect key={i} x={x} y={y} width={1} height={1} style={{ fill: c }} />
      ))}
    </svg>
  );
}
