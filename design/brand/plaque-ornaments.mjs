// How the hero plaque's ornaments (web/components/HeroPlaque.tsx) were drawn: gem, bead and sparkle
// from simple shapes with an ink outline, then the filigree swash (a wave that ends in a curl).
// Original art.   node design/brand/plaque-ornaments.mjs   → prints the maps as JSON

const outline = (g) => {
  const H = g.length, W = g[0].length;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
  const ink = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
  for (const [x, y] of ink) g[y][x] = "O";
  return g.map((r) => r.join(""));
};
// Gem: a cushion-cut stone in a gold setting, 13×11
export const GEM = (() => {
  const W = 13, H = 11, cx = 6, cy = 5;
  const g = Array.from({ length: H }, () => Array(W).fill("."));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.abs(x - cx) * 0.78 + Math.abs(y - cy);
    if (d <= 3.6) g[y][x] = y < cy ? (x <= cx ? "W" : "c") : y === cy ? (x < cx ? "c" : x === cx ? "W" : "m") : x <= cx ? "m" : "d"; // facets
    else if (d <= 4.6) g[y][x] = y <= cy && x <= cx ? "h" : y >= cy && x >= cx ? "s" : "Y"; // gold setting
  }
  g[cy - 2][cx - 1] = "W"; g[cy - 1][cx - 2] = "W"; // glint
  return outline(g);
})();
// Bead: a round gold bead with a highlight, 9×9
export const BEAD = (() => {
  const N = 9, c = 4;
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d <= 3.3) g[y][x] = d < 1.2 && x <= c && y <= c ? "W" : (x - c) + (y - c) < -1.5 ? "h" : (x - c) + (y - c) > 1.5 ? "s" : "Y";
  }
  g[c - 2][c - 1] = "W";
  return outline(g);
})();
// Sparkle: 4-point star, 9×9
export const SPARKLE = (() => {
  const N = 11, c = 5;
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.abs(x - c), dy = Math.abs(y - c);
    if ((dx / 4.4) ** (2 / 3) + (dy / 4.4) ** (2 / 3) <= 1) g[y][x] = dx + dy <= 1 ? "W" : x <= c && y <= c ? "h" : "Y";
  }
  return outline(g);
})();
export const ORN_PALETTE = { O: "#1A0800", W: "#FFFFFF", c: "#FFF1C2", m: "#E9D9B4", d: "#BFAE86", h: "#FFE680", Y: "#FFCB05", s: "#C47A00" };

// ── Filigree swash ──

const W = 30, H = 10;
const g = Array.from({ length: H }, () => Array(W).fill("."));
const pts = [];
// wave from the crest (x=0, low) outward, then a curl at the far end
for (let t = 0; t <= 1; t += 0.002) {
  const x = 1 + t * 21;
  const y = 6.2 - 2.6 * Math.sin(t * Math.PI * 1.15) + 0.6 * t;
  pts.push([x, y, t]);
}
// curl: a 1.6-turn spiral around (24.5, 4.6)
const [ex, ey] = pts[pts.length - 1];
const ccx = 24.4, ccy = 4.4;
const a0 = Math.atan2(ey - ccy, ex - ccx), r0 = Math.hypot(ex - ccx, ey - ccy);
for (let s = 0; s <= 1; s += 0.002) {
  const a = a0 - s * Math.PI * 1.75; // turn upward and back
  const r = r0 * (1 - 0.62 * s);
  pts.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a), 1 + s]);
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const px = x + 0.5, py = y + 0.5;
  let best = 9, bt = 0;
  for (const [sx, sy, t] of pts) { const d = Math.hypot(px - sx, py - sy); if (d < best) { best = d; bt = t; } }
  // thicker near the crest, tapering outward
  const w = bt < 0.15 ? 0.95 : bt < 1 ? 0.78 : 0.66;
  if (best <= w) g[y][x] = bt < 0.5 ? "Y" : "h";
}
const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
const ink = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
for (const [x, y] of ink) g[y][x] = "O";
export const SWASH = g.map((r) => r.join(""));


console.log(JSON.stringify({ GEM, BEAD, SPARKLE, SWASH }));
