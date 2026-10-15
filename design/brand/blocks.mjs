// Isometric pixel blocks for card 002 ("built on Arc": fast, final blocks) with a gold check badge.
// Original art, not Arc's logo.   node design/brand/blocks.mjs <out.json>  → web/components/PixelBlocks.tsx
import { writeFileSync } from "node:fs";
const [out] = process.argv.slice(2);
const W = 32, H = 19;
const g = Array.from({ length: H }, () => Array(W).fill("."));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
// One cube with its top vertex at (ox + 7, oy): top rhombus 14 wide x 7 tall, sides 7 tall
function cube(ox, oy) {
  const w = 12, th = 6, sh = 5;
  const cx = ox + w / 2;
  for (let y = oy; y < oy + th + sh + 1; y++) for (let x = ox; x < ox + w; x++) {
    const px = x + 0.5, py = y + 0.5;
    const top = Math.abs(px - cx) / (w / 2) + Math.abs(py - (oy + th / 2)) / (th / 2) <= 1;
    // sides: below the top's lower edges, above the same edges moved down by sh
    const lowerTop = oy + th / 2 + (th / 2) * (1 - Math.abs(px - cx) / (w / 2)); // y of the top's lower edge at px
    const side = py > lowerTop && py <= lowerTop + sh && px > ox && px < ox + w;
    if (top) set(x, y, "T");
    else if (side) set(x, y, px < cx ? "A" : "R");
  }
}
cube(9, 0);    // top
cube(3, 6);    // bottom left
cube(15, 6);   // bottom right
// outline: empty cells next to a filled cell
const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
const ink = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "." && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => filled(x + a, y + b))) ink.push([x, y]);
for (const [x, y] of ink) set(x, y, "O");
// face edges: a light rim where the top meets the sides, dark seam between the two sides
for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
  if ((g[y][x] === "A" || g[y][x] === "R") && g[y - 1][x] === "T") set(x, y, g[y][x] === "A" ? "a" : "r");
  if (g[y][x] === "A" && g[y][x + 1] === "R") set(x, y, "a");
}
// top highlight along the upper-left edge of each top face
for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) if (g[y][x] === "T" && (g[y - 1][x] === "O" || g[y][x - 1] === "O")) set(x, y, "t");
// gold "final" badge with a check mark, upper right
const badge = [
  "..OOOOO..",
  ".OhhhhGO.",
  "OhGGGGkGO",
  "OhGGGkksO",
  "OGkGkkGsO",
  "OGkkkGGsO",
  "OGGkGGssO",
  ".OGssssO.",
  "..OOOOO..",
];
badge.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") set(23 + x, 0 + y, c); }));
const rows = g.map((r) => r.join(""));
const palette = { O: "#050A1C", T: "#C9D3EE", t: "#FFFFFF", A: "#7E93CC", a: "#9FB3E6", R: "#3B5199", r: "#5068B0", G: "#FFCB05", h: "#FFE680", s: "#C47A00", k: "#1A0800" };
writeFileSync(out, JSON.stringify({ rows, palette }, null, 1));
console.log(rows.join("\n"));
