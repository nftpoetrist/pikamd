// Small single gold block for the footer ("Built on Arc").   node design/brand/block-glyph.mjs <out.json>
import { writeFileSync } from "node:fs";
const [out] = process.argv.slice(2);
const W = 12, H = 12;
const g = Array.from({ length: H }, () => Array(W).fill("."));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
const ox = 1, oy = 1, w = 10, th = 5, sh = 5, cx = ox + w / 2;
for (let y = oy; y < oy + th + sh + 1; y++) for (let x = ox; x < ox + w; x++) {
  const px = x + 0.5, py = y + 0.5;
  const top = Math.abs(px - cx) / (w / 2) + Math.abs(py - (oy + th / 2)) / (th / 2) <= 1;
  const lowerTop = oy + th / 2 + (th / 2) * (1 - Math.abs(px - cx) / (w / 2));
  const side = py > lowerTop && py <= lowerTop + sh && px > ox && px < ox + w;
  if (top) set(x, y, "T"); else if (side) set(x, y, px < cx ? "A" : "R");
}
const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
const ink = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "." && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => filled(x + a, y + b))) ink.push([x, y]);
for (const [x, y] of ink) set(x, y, "O");
for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
  if ((g[y][x] === "A" || g[y][x] === "R") && g[y - 1][x] === "T") set(x, y, g[y][x] === "A" ? "a" : "r");
}
for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) if (g[y][x] === "T" && (g[y - 1][x] === "O" || g[y][x - 1] === "O")) set(x, y, "t");
const rows = g.map((r) => r.join(""));
const palette = { O: "#1A0800", T: "#FFD740", t: "#FFF1C2", A: "#F0A500", a: "#FFCB05", R: "#C47A00", r: "#E08A00" };
writeFileSync(out, JSON.stringify({ rows, palette }, null, 1));
console.log(rows.join("\n"));
