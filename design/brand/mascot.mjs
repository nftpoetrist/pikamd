// How the PikaMd pika (web/components/brand/pika-art.ts) was drawn: shapes and contour shading from
// ellipses, then hand-placed details (eyes, nose, whiskers, paws, the .md page). Original art.
//   node design/brand/mascot.mjs <out.json> c   → { rows, palette, lids }; the site uses style "c"
// (dark whisker roots). The 16×16 favicon head was then drawn by hand from the same palette.
import { writeFileSync } from "node:fs";
const [out, style = "a"] = process.argv.slice(2);
const W = 32, H = 32;
const g = Array.from({ length: H }, () => Array(W).fill("."));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : ".");
const E = (cx, cy, rx, ry) => ({ cx, cy, rx, ry, f: (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 });
const parts = { earL: E(8.2, 5.6, 4.5, 4.5), earR: E(23.8, 5.6, 4.5, 4.5), body: E(16, 23.6, 10.2, 7.7), head: E(16, 13.6, 11.6, 8.2) };
const order = ["earL", "earR", "body", "head"];
const owner = (x, y) => { let o = null; for (const k of order) if (parts[k].f(x, y)) o = k; return o; };
const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && owner(x, y) !== null;
const LIGHT = [-0.6, -0.8];
// contour shading per part
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = owner(x, y); if (!k) continue;
  const p = parts[k];
  const nx = (x + 0.5 - p.cx) / p.rx, ny = (y + 0.5 - p.cy) / p.ry;
  const r = Math.hypot(nx, ny), d = (nx * LIGHT[0] + ny * LIGHT[1]) / (r || 1);
  let c = "B";
  if (r > 0.74 && d > 0.35) c = "L";
  if (r > 0.7 && d < -0.15) c = "M";
  if (r > 0.86 && d < -0.35) c = "S";
  g[y][x] = c;
}
// one darker rim cell on the lower right of the outline
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!solid(x, y)) continue;
  if ((!solid(x + 1, y) && !solid(x, y + 1)) || (!solid(x + 1, y + 1) && !solid(x, y + 1) && x > 15)) set(x, y, "D");
}
// forehead highlight cluster
for (const [x, y] of [[10, 7], [11, 7], [12, 7], [9, 8], [10, 8], [11, 8], [9, 9]]) if (owner(x, y) === "head") set(x, y, "L");
// chin shadow: body cells right under the head
for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (owner(x, y) === "body" && owner(x, y - 1) === "head") set(x, y, "S");
// ears: pale rim on the top arc, round inner ear
for (const k of ["earL", "earR"]) {
  const p = parts[k];
  const inner = E(p.cx + (k === "earL" ? 0.4 : -0.4), p.cy + 0.6, 2.2, 2.3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (owner(x, y) !== k) continue;
    if (!solid(x, y - 1) || ((!solid(x - 1, y) || !solid(x + 1, y)) && y < p.cy)) set(x, y, "C");
    if (inner.f(x, y)) set(x, y, "P");
  }
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(x, y) === "P" && get(x, y + 1) !== "P") set(x, y, "p");
// muzzle
const muzzle = E(16, 17.7, 4.7, 2.8);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (muzzle.f(x, y) && owner(x, y) === "head") set(x, y, "C");
set(13, 16, "W"); set(14, 16, "W");
// outline
const ink = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
for (const [x, y] of ink) set(x, y, "O");
// eyes 2x3 with a shine, nose, mouth. The fur under the eyes is kept for the blink overlay:
// closed, the eye is a line on its bottom row
const lids = [];
for (const ex of [10, 20]) for (let y = 12; y <= 14; y++) for (let x = ex; x <= ex + 1; x++) lids.push({ x, y, c: y === 14 ? "K" : g[y][x] });
for (const ex of [10, 20]) { for (let y = 12; y <= 14; y++) for (let x = ex; x <= ex + 1; x++) set(x, y, "K"); set(ex, 12, "E"); }
set(15, 16, "N"); set(16, 16, "N");
set(14, 18, "D"); set(15, 19, "D"); set(16, 19, "D"); set(17, 18, "D");
// whiskers
const outside = [[3, 15], [2, 15], [1, 14], [0, 14], [3, 17], [2, 17], [1, 18], [0, 18]];
for (const [x, y] of outside) { set(x, y, "w"); set(31 - x, y, "w"); }
if (style === "b") for (const [x, y] of [[7, 16], [8, 16], [7, 17], [8, 17]]) { set(x, y, "w"); set(31 - x, y, "w"); }
if (style === "c") for (const [x, y] of [[8, 16], [9, 16], [8, 18], [9, 18]]) { set(x, y, "S"); set(31 - x, y, "S"); }
// document held at the belly
const dx0 = 10, dy0 = 20, dw = 12, dh = 9;
const behindCorner = get(dx0 + dw - 1, dy0); // fur that shows through the folded corner
for (let y = dy0; y < dy0 + dh; y++) for (let x = dx0; x < dx0 + dw; x++) set(x, y, y === dy0 || y === dy0 + dh - 1 || x === dx0 || x === dx0 + dw - 1 ? "O" : "X");
set(dx0 + dw - 1, dy0, behindCorner); set(dx0 + dw - 2, dy0, "O"); set(dx0 + dw - 1, dy0 + 1, "O"); set(dx0 + dw - 2, dy0 + 1, "f");
for (let y = dy0 + 2; y < dy0 + dh - 1; y++) set(dx0 + dw - 2, y, "x");
for (let x = dx0 + 1; x < dx0 + dw - 1; x++) set(x, dy0 + dh - 2, "x");
for (let x = dx0 + 2; x <= dx0 + 6; x++) set(x, dy0 + 2, "l");
for (const [y, len] of [[dy0 + 4, 7], [dy0 + 6, 6]]) for (let x = dx0 + 2; x < dx0 + 2 + len; x++) set(x, y, "l");
// paws on the sides of the paper
for (const [px, py] of [[8, 23], [21, 23]]) {
  for (let y = py; y <= py + 2; y++) for (let x = px; x <= px + 2; x++) set(x, y, "C");
  set(px + (px < 16 ? 0 : 2), py + 2, "x");
  for (let x = px; x <= px + 2; x++) { set(x, py - 1, "O"); set(x, py + 3, "O"); }
  for (let y = py; y <= py + 2; y++) { set(px - 1, y, "O"); set(px + 3, y, "O"); }
}
// feet pads
for (const fx of [11, 18]) { for (let x = fx; x <= fx + 2; x++) set(x, 29, "C"); set(fx + 2, 29, "x"); }
const rows = g.map((r) => r.join(""));
const palette = { O: "#1A0800", D: "#7A4200", S: "#C47A00", M: "#E08A00", B: "#F0A500", L: "#FFD740", C: "#FFE8B0", W: "#FFF8E7", P: "#F2A08A", p: "#C9705E", K: "#1A0800", E: "#FFFFFF", N: "#7A2E22", w: "#FFE9C2", X: "#FFF8E7", x: "#E9D9B4", l: "#B08A4A", f: "#D8C49A" };
writeFileSync(out, JSON.stringify({ rows, palette, lids }, null, 1));
