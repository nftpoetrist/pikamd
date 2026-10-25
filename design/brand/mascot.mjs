// How the PikaMd cat (web/components/brand/pika-art.ts) was drawn: shapes and contour shading from
// ellipses and triangles, then hand-placed details (tabby stripes, eyes, pink nose, small smile,
// whiskers, curled tail, paws, the .md page). Original art, same palette and pose as the pika
// it replaced (2026-10-25), so every place that shows the mascot keeps its size and layout.
//   node design/brand/mascot.mjs <out.json>   → { rows, palette, lids }
// The 16×16 favicon head and the PikaGold coin face were then drawn by hand from the same palette.
import { writeFileSync } from "node:fs";
const [out] = process.argv.slice(2);
const W = 32, H = 32;
const g = Array.from({ length: H }, () => Array(W).fill("."));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : ".");
const E = (cx, cy, rx, ry) => ({ cx, cy, rx, ry, f: (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 });
// Triangle, tested at pixel centers
const T = (a, b, c) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const f = (x, y) => {
    const p = [x + 0.5, y + 0.5], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  return { cx: (a[0] + b[0] + c[0]) / 3, cy: (a[1] + b[1] + c[1]) / 3, rx: 5, ry: 5, f };
};
// Tail: placed cell by cell, curling up the right side of the body
const TAIL = new Set(["27,21", "28,21", "28,22", "29,22", "28,23", "29,23", "28,24", "29,24", "28,25", "29,25",
  "27,26", "28,26", "29,26", "26,27", "27,27", "28,27", "24,28", "25,28", "26,28", "27,28"]);
const parts = {
  tail: { cx: 28, cy: 25, rx: 3, ry: 5, f: (x, y) => TAIL.has(`${x},${y}`) },
  earL: T([5.0, 1.4], [3.0, 11], [13.8, 7.4]),
  earR: T([27.0, 1.4], [29.0, 11], [18.2, 7.4]),
  body: E(15.6, 24.2, 9.8, 7.4),
  head: E(16, 14.4, 12.4, 7.9),
};
const order = ["tail", "earL", "earR", "body", "head"];
const owner = (x, y) => { let o = null; for (const k of order) if (parts[k].f(x, y)) o = k; return o; };
const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && owner(x, y) !== null;
const LIGHT = [-0.6, -0.8];
// Contour shading per part; ears are lit flat (light on the left ear, shade on the right)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = owner(x, y); if (!k) continue;
  const p = parts[k];
  const nx = (x + 0.5 - p.cx) / p.rx, ny = (y + 0.5 - p.cy) / p.ry;
  const r = Math.hypot(nx, ny), d = (nx * LIGHT[0] + ny * LIGHT[1]) / (r || 1);
  let c = "B";
  if (r > 0.74 && d > 0.35) c = "L";
  if (r > 0.7 && d < -0.15) c = "M";
  if (r > 0.86 && d < -0.35) c = "S";
  if (k.startsWith("ear")) c = x < 16 ? (y < 4 ? "L" : "B") : (y < 4 ? "B" : "M");
  g[y][x] = c;
}
// Tail: light on its left edge, shade on the right and bottom, two stripes, a light tip
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (owner(x, y) === "tail") {
  if (!solid(x - 1, y)) set(x, y, "L"); else if (!solid(x + 1, y) || !solid(x, y + 1)) set(x, y, "S"); else set(x, y, "B");
}
for (const [x, y] of [[28, 23], [29, 23], [28, 26], [29, 26]]) set(x, y, "M");
for (const [x, y] of [[27, 21], [28, 21], [28, 22]]) set(x, y, "L");
// One darker rim cell on the lower right of the outline
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!solid(x, y) || owner(x, y) === "tail") continue;
  if ((!solid(x + 1, y) && !solid(x, y + 1)) || (!solid(x + 1, y + 1) && !solid(x, y + 1) && x > 15)) set(x, y, "D");
}
// Chin shadow: body cells right under the head
for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (owner(x, y) === "body" && owner(x, y - 1) === "head") set(x, y, "S");
// Inner ears, shaded along their bottom edge
const inL = T([5.9, 3.8], [5.0, 9.5], [11.2, 7.6]);
const inR = T([26.1, 3.8], [27.0, 9.5], [20.8, 7.6]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (inL.f(x, y) && owner(x, y) === "earL") set(x, y, "P");
  if (inR.f(x, y) && owner(x, y) === "earR") set(x, y, "P");
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(x, y) === "P" && get(x, y + 1) !== "P") set(x, y, "p");
// Tabby stripes on the forehead and cheeks
for (const [x, y] of [[15, 8], [16, 8], [15, 9], [16, 9], [12, 9], [12, 10], [19, 9], [19, 10]]) set(x, y, "M");
for (const [x, y] of [[5, 14], [6, 14], [5, 16], [6, 16]]) { set(x, y, "M"); set(31 - x, y, "S"); }
// Muzzle: two whisker pads and a chin
for (const m of [E(14.0, 18.4, 2.5, 1.7), E(18.0, 18.4, 2.5, 1.7), E(16, 19.9, 2.0, 1.2)])
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.f(x, y) && owner(x, y) === "head") set(x, y, "C");
// Outline
const ink = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
for (const [x, y] of ink) set(x, y, "O");
// Eyes 2×3 with a shine. The fur under the eyes is kept for the blink overlay: closed, the eye
// is a line on its bottom row
const lids = [];
for (const ex of [10, 20]) for (let y = 13; y <= 15; y++) for (let x = ex; x <= ex + 1; x++) lids.push({ x, y, c: y === 15 ? "K" : g[y][x] });
for (const ex of [10, 20]) { for (let y = 13; y <= 15; y++) for (let x = ex; x <= ex + 1; x++) set(x, y, "K"); set(ex, 13, "E"); }
// Pink nose (an upside-down triangle) and a small smile
for (const x of [14, 15, 16, 17]) set(x, 16, "P");
set(15, 17, "p"); set(16, 17, "p");
for (const [x, y] of [[14, 18], [17, 18], [15, 19], [16, 19]]) set(x, y, "D");
// Whiskers, three per side
for (const [x, y] of [[3, 16], [2, 16], [1, 15], [0, 15], [3, 18], [2, 18], [1, 18], [0, 18], [3, 19], [2, 20], [1, 20], [0, 20]]) { set(x, y, "w"); set(31 - x, y, "w"); }
// Document held at the belly
const dx0 = 10, dy0 = 21, dw = 12, dh = 9;
const behindCorner = get(dx0 + dw - 1, dy0); // fur that shows through the folded corner
for (let y = dy0; y < dy0 + dh; y++) for (let x = dx0; x < dx0 + dw; x++) set(x, y, y === dy0 || y === dy0 + dh - 1 || x === dx0 || x === dx0 + dw - 1 ? "O" : "X");
set(dx0 + dw - 1, dy0, behindCorner); set(dx0 + dw - 2, dy0, "O"); set(dx0 + dw - 1, dy0 + 1, "O"); set(dx0 + dw - 2, dy0 + 1, "f");
for (let y = dy0 + 2; y < dy0 + dh - 1; y++) set(dx0 + dw - 2, y, "x");
for (let x = dx0 + 1; x < dx0 + dw - 1; x++) set(x, dy0 + dh - 2, "x");
for (let x = dx0 + 2; x <= dx0 + 6; x++) set(x, dy0 + 2, "l");
for (const [y, len] of [[dy0 + 4, 7], [dy0 + 6, 6]]) for (let x = dx0 + 2; x < dx0 + 2 + len; x++) set(x, y, "l");
// Paws on the sides of the paper
for (const [px, py] of [[8, 24], [21, 24]]) {
  for (let y = py; y <= py + 2; y++) for (let x = px; x <= px + 2; x++) set(x, y, "C");
  set(px + (px < 16 ? 0 : 2), py + 2, "x");
  for (let x = px; x <= px + 2; x++) { set(x, py - 1, "O"); set(x, py + 3, "O"); }
  for (let y = py; y <= py + 2; y++) { set(px - 1, y, "O"); set(px + 3, y, "O"); }
}
const rows = g.map((r) => r.join(""));
const palette = { O: "#1A0800", D: "#7A4200", S: "#C47A00", M: "#E08A00", B: "#F0A500", L: "#FFD740", C: "#FFE8B0", P: "#F2A08A", p: "#C9705E", K: "#1A0800", E: "#FFFFFF", w: "#FFE9C2", X: "#FFF8E7", x: "#E9D9B4", l: "#B08A4A", f: "#D8C49A" };
writeFileSync(out, JSON.stringify({ rows, palette, lids }, null, 1));
