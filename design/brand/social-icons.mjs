// Original pixel icons for the X header, one per guideline kind: Rules (page), Skills (gear),
// Prompts (speech bubble), Agents (robot head). Used by design/brand/social.mjs. No third-party logos.
const outline = (g) => {
  const H = g.length, W = g[0].length;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== "." && g[y][x] !== "O";
  const ink = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
  for (const [x, y] of ink) g[y][x] = "O";
  return g.map((r) => r.join(""));
};
const grid = (W, H) => Array.from({ length: H }, () => Array(W).fill("."));
const shade = (g, light, mid, dark, fill) => {
  const H = g.length, W = g[0].length;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] === fill;
  const out = g.map((r) => [...r]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === fill) {
    if (!inside(x, y - 1) || !inside(x - 1, y)) out[y][x] = light;
    else if (!inside(x, y + 1) || !inside(x + 1, y)) out[y][x] = dark;
    else out[y][x] = mid;
  }
  return out;
};

// Rules: a page with a folded corner and text lines, 16×20
export const RULES = (() => {
  const W = 18, H = 22, g = grid(W, H);
  for (let y = 1; y <= 20; y++) for (let x = 1; x <= 16; x++) g[y][x] = "#";
  for (let i = 0; i < 5; i++) for (let j = 0; j <= 4 - i; j++) g[1 + i][16 - j] = "."; // cut corner
  let s = shade(g, "c", "X", "x", "#");
  for (let i = 0; i < 5; i++) s[1 + i][12 - 0 + (i > 0 ? 0 : 0)] = s[1 + i][12]; // keep
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) s[2 + i][12 + j] = "f"; // fold
  for (const [y, x0, x1] of [[8, 3, 12], [11, 3, 14], [14, 3, 11], [17, 3, 13]]) for (let x = x0; x <= x1; x++) s[y][x] = "l";
  for (let x = 3; x <= 7; x++) s[5][x] = "Y"; // a gold heading
  return outline(s);
})();

// Skills: a gear with 8 teeth, 20×20
export const SKILLS = (() => {
  const N = 21, c = 10, g = grid(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const tooth = Math.cos(a * 8) > 0.35 ? 9.2 : 7.2;
    if (r <= tooth && r > 3.1) g[y][x] = "#";
  }
  const s = shade(g, "e", "E", "q", "#");
  return outline(s);
})();

// Prompts: a speech bubble with a ">_" prompt inside, 22×18
export const PROMPTS = (() => {
  const W = 23, H = 19, g = grid(W, H);
  for (let y = 1; y <= 12; y++) for (let x = 1; x <= 21; x++) {
    const corner = (x < 3 || x > 19) && (y < 3 || y > 10);
    if (!corner || (x === 2 || x === 20) && (y === 2 || y === 11)) g[y][x] = "#";
  }
  for (const [x, y] of [[5, 13], [6, 13], [7, 13], [5, 14], [6, 14], [5, 15]]) g[y][x] = "#"; // tail
  const s = shade(g, "v", "V", "u", "#");
  for (const [x, y] of [[5, 4], [6, 5], [7, 6], [6, 7], [5, 8]]) s[y][x] = "c"; // ">"
  for (let x = 9; x <= 13; x++) s[8][x] = "c"; // "_"
  return outline(s);
})();

// Agents: a robot head with an antenna, 20×21
export const AGENTS = (() => {
  const W = 21, H = 22, g = grid(W, H);
  for (let y = 6; y <= 19; y++) for (let x = 2; x <= 18; x++) {
    const corner = (x === 2 || x === 18) && (y === 6 || y === 19);
    if (!corner) g[y][x] = "#";
  }
  for (let y = 3; y <= 5; y++) g[y][10] = "#"; // antenna
  for (const [x, y] of [[9, 1], [10, 1], [11, 1], [9, 2], [10, 2], [11, 2]]) g[y][x] = "B"; // bulb
  for (let y = 10; y <= 13; y++) { g[y][1] = "#"; g[y][19] = "#"; } // ears
  const s = shade(g, "a", "A", "r", "#");
  for (const [x0, y0] of [[5, 9], [12, 9]]) for (let y = y0; y <= y0 + 2; y++) for (let x = x0; x <= x0 + 3; x++) s[y][x] = y === y0 && x === x0 ? "W" : "k"; // eyes
  for (const [x0, y0] of [[5, 9], [12, 9]]) { s[y0][x0] = "W"; s[y0 + 1][x0 + 1] = "c"; }
  for (let x = 6; x <= 14; x++) s[15][x] = x % 2 ? "O" : "a"; // mouth grill
  s[1][9] = "W"; s[1][10] = "Y"; s[2][9] = "Y"; s[1][11] = "Y"; s[2][10] = "Y"; s[2][11] = "s";
  return outline(s);
})();

export const ICON_PALETTE = {
  O: "#1A0800", k: "#1A0800", W: "#FFFFFF",
  c: "#FFF8E7", X: "#FFF1D6", x: "#E9D9B4", l: "#B08A4A", f: "#D8C49A", // page
  Y: "#FFCB05", s: "#C47A00", B: "#FFCB05", // gold
  e: "#8FE3B5", E: "#3FBF7F", q: "#17613F", // emerald gear
  v: "#D7C4FF", V: "#9B7BE0", u: "#4E2A8A", // violet bubble
  a: "#E6EEFF", A: "#9FB3E6", r: "#3B5199", // sky-silver robot
};
