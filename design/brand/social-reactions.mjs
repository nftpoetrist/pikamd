// PikaMd reaction GIFs for X replies (2026-11-04): the mascot (pika-art.ts) dressed up for three
// everyday crypto replies, each its own scene, outfit, palette and loop. Meme tropes only, no
// third-party meme characters or logos.
//   gm     a sleepy morning: knit beanie, a steaming mug on the counter, a slow blink, pastel sky
//   wagmi  the shades drop from above, a gold chain with a PikaGold medallion, purple party rays
//   lfg    astronaut helmet on a rocket, flickering flame, stars streaking past, the moon ahead
// The Arc set (same day; Arc in the blocks, the arch and the blue coins, each its own mood; no Arc or
// USDC logo):
//   build  an architect (white hard hat, round glasses, pencil) draws an arch on blueprint paper,
//          the blocks go in from both sides, PikaMd's gold keystone drops in last
//   train  the chain of blocks: a conductor cat on block cars with gold checks, through a sunset
//   rain   fees in dollars: top hat, monocle, bow tie, blank blue coins spinning down on a red velvet stage
// No text at all (user request), so a reply's own words sit on top. Everything is drawn on a
// 60×60 pixel grid at 10 px (600×600); build uses 75×75 at 8 px.
//   design/brand/pikamd-react-{gm,wagmi,lfg,build,train,rain}.gif  (git-ignored: uploaded to X by hand)
//   one at a time: add its name, e.g. … social-reactions.mjs build
//
//   node --experimental-strip-types design/brand/social-reactions.mjs
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../../web");
const sharp = createRequire(join(WEB, "package.json"))("sharp");
const { PIKA, PIKA_PALETTE, PIKA_LIDS } = await import(join(WEB, "components/brand/pika-art.ts"));

let N = 60; // grid cells across; the build GIF uses a finer 75 (8 px) so its arch can be bigger
const SIZE = 600;
const INK = "#1A0800";

// ── Grid helpers ─────────────────────────────────────────────────────────────────────────────
const grid = (fill = null) => Array.from({ length: N }, () => Array(N).fill(fill));
const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
function stamp(g, map, pal, ox, oy) {
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c !== "." && c !== " " && pal[c]) put(g, ox + x, oy + y, pal[c]); } });
}
/** Pads a map by one pixel and draws an ink "O" around every solid pixel. */
function outlined(rows) {
  const h = rows.length + 2, w = Math.max(...rows.map((r) => r.length)) + 2;
  const at = (x, y) => rows[y - 1]?.[x - 1] ?? ".";
  const solid = (x, y) => { const c = at(x, y); return c !== "." && c !== " "; };
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) =>
    solid(x, y) ? at(x, y) : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b)) ? "O" : ".").join(""));
}
function toSvg(g) {
  let rects = "";
  g.forEach((row, y) => {
    let x = 0;
    while (x < N) {
      const c = row[x]; let end = x + 1;
      while (end < N && row[end] === c) end++;
      if (c) rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${c}"/>`;
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${rects}</svg>`;
}
function line(g, x0, y0, x1, y1, colors) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, colors[i % colors.length]);
}

/** The mascot, optionally blinking. */
function cat({ closed = false } = {}) {
  const rows = PIKA.map((r) => [...r]);
  if (closed) for (const { x, y, c } of PIKA_LIDS) rows[y][x] = c;
  return rows.map((r) => r.join(""));
}
const PAL = { ...PIKA_PALETTE };

// ── 1. GM ────────────────────────────────────────────────────────────────────────────────────
const BEANIE = outlined([
  ".....wwww.....",
  ".....wwvw.....",
  "....RRRRRR....",
  "...QRRRRRRr...",
  "..QRRRRRRRRr..",
  ".QRRRRRRRRRRr.",
  "QRRRRRRRRRRRRr",
  "QRRrRRRrRRRrRr",
  "cCcCcCcCcCcCcC",
  "CcCcCcCcCcCcCc",
]);
const BEANIE_PAL = { O: INK, w: "#FFF8E7", v: "#E9D9B4", R: "#E0503F", r: "#A8322A", Q: "#FF8A6A", c: "#FFF1C2", C: "#E9C98A" };
const MUG = [
  ".OOOOOOOOO...",
  "OKkkkkkkkKO..",
  "OMmmmmmmmsOO.",
  "OMggggggggOmO",
  "OMmmmmmmmsOmO",
  "OMmmmmmmmsOmO",
  "OMmmmmmmmsmmO",
  "OMmmmmmmmsOO.",
  ".OssssssssO..",
  "..OOOOOOOO...",
];
const MUG_PAL = { O: INK, K: "#B5763A", k: "#5A2E10", M: "#8FAAF0", m: "#4E66B8", s: "#2E4183", g: "#FFCB05" };

function gmFrame(t) {
  const g = grid();
  // Pastel morning sky in steps, warm near the counter
  const sky = ["#9CCBF0", "#AED4F2", "#C3DDF2", "#DCE3EE", "#F2DCD2", "#FBD2BC", "#FFC9A4"];
  for (let y = 0; y < 44; y++) for (let x = 0; x < N; x++) g[y][x] = sky[Math.min(sky.length - 1, Math.floor(y / 6.4))];
  // Sun with twinkling rays (top right)
  const SX = 50, SY = 11;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - SX, y - SY);
    if (d < 4.6) g[y][x] = d < 2.6 ? "#FFF8E7" : "#FFE680";
    else if (d < 5.6) g[y][x] = "#FFCB05";
  }
  const long = Math.floor(t / 3) % 2 === 0;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + (long ? 0 : Math.PI / 8);
    for (let r = 7; r <= (k % 2 ? 8 : long ? 10 : 9); r++) put(g, SX + Math.cos(a) * r, SY + Math.sin(a) * r, "#FFCB05");
  }
  // Two clouds
  const cloud = ["...WWW....", ".WWWWWWW..", "WWWWWWWWWW", ".ssssssss."];
  stamp(g, cloud, { W: "#FFFFFF", s: "#DCE3EE" }, 20, 3);
  stamp(g, cloud, { W: "#FFFFFF", s: "#DCE3EE" }, 44, 30);
  // The cat leaning on the counter, beanie on, a slow blink
  const CX = 16, CY = 13;
  stamp(g, cat({ closed: t === 8 || t === 9 }), PAL, CX, CY);
  stamp(g, BEANIE, BEANIE_PAL, CX + 8, CY);
  // Counter
  for (let y = 42; y < N; y++) for (let x = 0; x < N; x++)
    g[y][x] = y === 42 ? INK : y === 43 ? "#F0A500" : y === 44 ? "#C47A00" : y < 50 ? ((x + (y % 2) * 5) % 10 === 0 ? "#6A3800" : "#7A4200") : y === 50 ? INK : "#4A2600";
  // The mug and its steam (three wisps rising on a six-frame cycle)
  const MX = 4, MY = 32;
  stamp(g, MUG, MUG_PAL, MX, MY);
  for (let w = 0; w < 3; w++) {
    const phase = (t + w * 2) % 6;
    for (let i = 0; i < 5; i++) {
      const y = MY - 2 - phase - i * 2;
      const x = MX + 3 + w * 2 + Math.round(Math.sin((y + w) * 0.9));
      if (y > MY - 15) put(g, x, y, i < 2 ? "#FFFFFF" : "#EEF2FF");
    }
  }
  return toSvg(g);
}

// ── 2. WAGMI ─────────────────────────────────────────────────────────────────────────────────
const SHADES = [
  "OOOOOOOOOOOOOOOOOOOO",
  "OgWWggggOOOOgWWggggO",
  "OgWgggggO..OgWgggggO",
  ".OgggghO....OgggghO.",
  "..OOOOO......OOOOO..",
];
const SHADES_PAL = { O: "#0A0610", g: "#1E1A2E", W: "#FFFFFF", h: "#7A5AB0" };
const COIN = [
  "..OOOO..",
  ".OyyyyO.",
  "OyLLyyYO",
  "OyLyyyYO",
  "OyyyyyYO",
  "OyyyyYYO",
  ".OYYYYO.",
  "..OOOO..",
];
const COIN_PAL = { O: INK, L: "#FFF1C2", y: "#FFCB05", Y: "#C47A00" };
const SPARK = [".W.", "WWW", ".W."];
const DROP = [-22, -19, -16, -13, -10, -7, -5, -3, -1, 0];
const WAGMI_FRAMES = DROP.length + 20;

function wagmiFrame(t) {
  const g = grid();
  // Rotating sunburst: 16 rays, two purples, a full pattern period every 45°
  const CX0 = 29.5, CY0 = 30;
  const rot = (t / WAGMI_FRAMES) * (Math.PI / 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = Math.atan2(y - CY0, x - CX0) + rot;
    const s = Math.floor(((a % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 8)) % 2;
    const d = Math.hypot(x - CX0, y - CY0);
    g[y][x] = d < 9 ? (s ? "#B054E0" : "#C46CF0") : s ? "#6A22A8" : "#8A36C8";
  }
  const CX = 14, CY = 15;
  stamp(g, cat(), PAL, CX, CY);
  // Gold chain (alternating links) and the PikaGold medallion
  const chain = ["#FFCB05", "#C47A00"];
  for (const [dy, c] of [[1, ["#7A4200"]], [0, chain]]) { line(g, CX + 6, CY + 20 + dy, CX + 13, CY + 24 + dy, c); line(g, CX + 25, CY + 20 + dy, CX + 18, CY + 24 + dy, c); }
  stamp(g, COIN, COIN_PAL, CX + 12, CY + 23);
  const landed = t >= DROP.length;
  // The shades drop from above the head and land on the eyes
  stamp(g, SHADES, SHADES_PAL, CX + 6, CY + 12 + (landed ? 0 : DROP[t]));
  if (landed) {
    const k = t - DROP.length;
    if (k < 3) { stamp(g, SPARK, { W: "#FFFFFF" }, CX + 2, CY + 9); stamp(g, SPARK, { W: "#FFFFFF" }, CX + 26, CY + 9); }
    if (k % 6 < 2) stamp(g, SPARK, { W: "#FFFFFF" }, CX + 18, CY + 22); // the medallion glints
  }
  const cap = landed ? `<div class="cap wagmi${t === DROP.length ? " pop" : ""}">WAGMI</div>` : "";
  return toSvg(g);
}
const WAGMI_DELAYS = Array.from({ length: WAGMI_FRAMES }, (_, t) => (t < DROP.length ? 60 : t === WAGMI_FRAMES - 1 ? 700 : 110));

// ── 3. LFG ───────────────────────────────────────────────────────────────────────────────────
/** A rocket pointing right, its length L, its body nine pixels tall, centred on row 0. */
function rocket(L) {
  const rows = [];
  for (let dy = -8; dy <= 8; dy++) {
    let row = "";
    for (let x = 0; x < L; x++) {
      const nose = L - 9, hb = x < 2 ? 2 : x >= nose ? Math.round(4 * (L - 1 - x) / 9) : 4;
      let c = ".";
      if (Math.abs(dy) <= hb) {
        c = x < 2 ? "n" : x >= nose ? (dy < 0 ? "R" : "r") : dy <= -3 ? "L" : dy >= 3 ? "s" : "B";
        if (x >= 9 && x <= 10 && x < nose) c = "g";
        const wx = L - 15, d = Math.hypot(x - wx, dy);
        if (d < 2.7) c = d < 1.6 ? "w" : "b";
      }
      // Fins: slanted triangles above and below the tail
      const fin = x >= 2 && x <= 9 && Math.abs(dy) > 4 && Math.abs(dy) <= 4 + Math.min(4, Math.floor((10 - x) / 2));
      if (fin) c = Math.abs(dy) === 5 ? "r" : "R";
      row += c;
    }
    rows.push(row);
  }
  return outlined(rows);
}
const ROCKET_PAL = { O: "#07040F", n: "#6A6A80", R: "#E0503F", r: "#A8322A", L: "#FFFFFF", B: "#E6EAF5", s: "#AEB6CC", g: "#FFCB05", w: "#C9F2FF", b: "#4E66B8" };
const FLAME = [
  ["....oyyW", "..ooyyWW", "ooyyWWWW", "..ooyyWW", "....oyyW"],
  ["......yW", "...oyyWW", ".ooyyWWW", "...oyyWW", "......yW"],
  ["...ooyyW", ".ooyyyWW", "oooyyWWW", ".ooyyyWW", "...ooyyW"],
  [".....oyW", "..oooyWW", "ooyyyWWW", "..oooyWW", ".....oyW"],
];
const FLAME_PAL = { o: "#F06A1A", y: "#FFCB05", W: "#FFF8E7" };
const MOON = (() => {
  const g = [], R = 6.6, c = 7;
  for (let y = 0; y < 15; y++) {
    let row = "";
    for (let x = 0; x < 15; x++) {
      const d = Math.hypot(x - c, y - c);
      row += d > R ? "." : Math.hypot(x - c + 2, y - c - 2) < 1.6 || Math.hypot(x - c - 2.5, y - c + 1) < 1.2 ? "c" : x + y > 17 ? "s" : "m";
    }
    g.push(row);
  }
  return g;
})();
const LFG_FRAMES = 20;
const BOB = [0, 0, -1, -1, -1, 0, 0, 1, 1, 1];
let lseed = 7;
const lrnd = () => { lseed = (lseed * 1664525 + 1013904223) % 4294967296; return lseed / 4294967296; };
const STREAKS = Array.from({ length: 26 }, () => ({ x: Math.floor(lrnd() * N), y: Math.floor(lrnd() * N), len: 2 + Math.floor(lrnd() * 4), dim: lrnd() < 0.5 }));
const DOTS = Array.from({ length: 40 }, () => ({ x: Math.floor(lrnd() * N), y: Math.floor(lrnd() * N) }));

function lfgFrame(t) {
  const g = grid();
  const space = ["#07040F", "#0B0618", "#100A22", "#160D2C", "#1C1036"];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y][x] = space[Math.floor(y / 12)];
  for (const d of DOTS) put(g, d.x, d.y, "#3A2E5A");
  // Streaks fly left 3 px a frame: 60 px in 20 frames, one full wrap
  for (const s of STREAKS) {
    const x0 = (((s.x - t * 3) % N) + N) % N;
    for (let i = 0; i < s.len; i++) put(g, (x0 + i) % N, s.y, i === 0 ? "#FFFFFF" : s.dim ? "#4A3C78" : "#8F7AD0");
  }
  stamp(g, MOON, { m: "#FFF1C2", s: "#E9D3A0", c: "#D6BC86" }, 51, 3);
  const b = BOB[t % BOB.length];
  const RX = 10, RY = 47 + b; // rocket's middle row
  const R = rocket(42);
  stamp(g, R, ROCKET_PAL, RX, RY - 9);
  stamp(g, FLAME[t % 4], FLAME_PAL, RX - 7, RY - 2);
  // The cat astride the rocket, in an astronaut helmet
  const CX = 18, CY = RY - 34;
  stamp(g, cat(), PAL, CX, CY);
  const hx = CX + 15.5, hy = CY + 11, HR = 16;
  for (let y = CY - 6; y <= CY + 21; y++) for (let x = CX - 2; x <= CX + 33; x++) {
    const d = Math.hypot(x - hx, y - hy), a = Math.atan2(y - hy, x - hx);
    if (Math.abs(d - HR) < 0.55) put(g, x, y, "#A8E6FF");
    else if (d > HR - 2.6 && d < HR - 1.3 && a > -2.5 && a < -1.75) put(g, x, y, "#FFFFFF");
  }
  // Suit collar where the helmet meets the body
  for (let x = CX + 3; x <= CX + 28; x++) { put(g, x, CY + 21, "#C9D6FF"); put(g, x, CY + 22, "#8FAAF0"); put(g, x, CY + 23, "#2E4183"); }
  return toSvg(g);
}

// ── Rendering: no text anywhere, so sharp draws the SVG grids itself ──────────────────────────
// ── Arc set (2026-11-04): three more, each about Arc, in the site's Arc blues ────────────────
// No Arc logo (its rules forbid redrawing it) and no USDC logo: blocks, an arch, blank blue coins.
const SPARK4 = ["..W..", "..W..", "WWWWW", "..W..", "..W.."];
const CHECK7 = [".......Y", "......YY", "Y....YY.", "YY..YY..", ".YYYY...", "..YY....", "........"];

// 4. build: an architect draws an arch on blueprint paper, its blocks go in from both sides, the
// gold keystone (PikaMd's piece) drops in last. White hard hat, round glasses, pencil behind the ear.
const ARCH = { cx: 37, cy: 54, R: 33, r: 22, n: 9, KEY: 4 };
function archAt(x, y) {
  const dx = x - ARCH.cx, dy = ARCH.cy - y;
  if (dy < 0) return null;
  const d = Math.hypot(dx, dy);
  if (d < ARCH.r || d > ARCH.R) return null;
  const f = (Math.PI - Math.atan2(dy, dx)) / (Math.PI / ARCH.n); // 0 at the left foot … n at the right
  const i = Math.min(ARCH.n - 1, Math.floor(f));
  const seam = Math.abs(f - Math.round(f)) * (Math.PI / ARCH.n) * d < 0.55 && Math.round(f) > 0 && Math.round(f) < ARCH.n;
  const edge = d < ARCH.r + 0.75 || d > ARCH.R - 0.75;
  return { i, f, d, seam, edge, outer: ARCH.R - d, inner: d - ARCH.r };
}
const HARDHAT = outlined([
  ".....YYYY.....",
  "...YYLLYYYY...",
  "..YLLYYYYYYs..",
  ".YLYYYsYYYYYs.",
  ".YYYYYsYYYYYs.",
  "bbbbbbbbbbbbbb",
]);
const WHITE_HAT = { O: "#0C1A3E", Y: "#F4F6FF", L: "#FFFFFF", s: "#C9D6FF", b: "#AEB6CC" };
const PENCIL = ["......k", ".....yk", "....yy.", "...yy..", "..yy...", ".yy....", "pp.....", "p......"];
const PENCIL_PAL = { k: "#1A0800", y: "#FFCB05", p: "#F2A08A" };
// The page in its paws becomes a blueprint sheet
const BLUEPRINT_PAL = { ...PIKA_PALETTE, X: "#8FAAF0", x: "#6A86D8", l: "#FFFFFF", f: "#C9D6FF" };
const BUILD_TRACE = 10, BUILD_FILL = 8, BUILD_DROP = [20, 15, 10, 6, 3, 0], BUILD_END = 8;
const BUILD_FRAMES = BUILD_TRACE + BUILD_FILL + BUILD_DROP.length + BUILD_END;

function buildFrame(t) {
  const g = grid();
  // Blueprint paper: Arc navy with a fine grid and a stronger one every 10 px
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    g[y][x] = x % 10 === 0 || y % 10 === 0 ? "#2E4183" : x % 5 === 0 || y % 5 === 0 ? "#22377A" : "#1C3272";
  const traced = Math.min(1, (t + 1) / BUILD_TRACE) * ARCH.n; // how far the outline has been drawn
  const fillStep = Math.max(0, Math.min(4, Math.floor((t - BUILD_TRACE) / 2) + 1)); // pairs of blocks laid
  const dropK = t - BUILD_TRACE - BUILD_FILL;
  const keyOff = dropK < 0 ? null : BUILD_DROP[Math.min(dropK, BUILD_DROP.length - 1)];
  const done = dropK >= BUILD_DROP.length - 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = archAt(x, y);
    // The keystone, sliding down into its slot
    const k = keyOff !== null ? archAt(x, y + keyOff) : null;
    if (k && k.i === ARCH.KEY) {
      g[y][x] = k.edge || k.seam ? "#7A4200" : k.outer < 1.8 ? "#FFE680" : k.inner < 1.8 ? "#C47A00" : "#FFCB05";
      continue;
    }
    if (!a) continue;
    const laid = t >= BUILD_TRACE && a.i !== ARCH.KEY && (a.i < fillStep || a.i > ARCH.n - 1 - fillStep);
    if (laid) g[y][x] = a.edge || a.seam ? "#0C1A3E" : a.outer < 1.8 ? "#8FAAF0" : a.inner < 1.8 ? "#2E4183" : "#4E66B8";
    else if ((a.edge || a.seam) && a.f <= traced && (x + y) % 2 === 0) g[y][x] = "#FFFFFF"; // dashed pencil line
  }
  // Ground line of the drawing
  for (let x = 2; x < N - 2; x++) if (x % 3 !== 2) put(g, x, ARCH.cy + 1, "#C9D6FF");
  // Dust when the keystone lands
  if (dropK === BUILD_DROP.length - 1 || dropK === BUILD_DROP.length) {
    const y = ARCH.cy - ARCH.R + 1;
    for (const [dx, dy] of [[-5, 0], [-6, -1], [-7, 1], [5, 0], [6, -1], [7, 1]]) put(g, ARCH.cx + dx, y + dy, "#FFF1C2");
  }
  // The architect, framed by the arch's doorway
  const CX = 21, CY = 42;
  stamp(g, cat({ closed: t === BUILD_FRAMES - 4 || t === BUILD_FRAMES - 3 }), BLUEPRINT_PAL, CX, CY);
  stamp(g, PENCIL, PENCIL_PAL, CX + 21, CY - 1);
  stamp(g, HARDHAT, WHITE_HAT, CX + 8, CY + 2);
  // Round glasses: thin rings round both eyes and a bridge
  for (const ex of [10.5, 20.5]) for (let y = 10; y <= 18; y++) for (let x = ex - 4; x <= ex + 4; x++)
    if (Math.abs(Math.hypot(x - ex, y - 14) - 3) < 0.5) put(g, CX + x, CY + y, "#FFF8E7");
  for (let x = 14; x <= 17; x++) put(g, CX + x, CY + 13, "#FFF8E7");
  // Sparkles once it stands
  if (done) {
    const k = t - (BUILD_TRACE + BUILD_FILL + BUILD_DROP.length - 1);
    const spots = [[6, 30], [64, 26], [12, 10], [58, 44], [35, 6], [66, 8], [4, 52]];
    spots.forEach(([x, y], i) => { if ((k + i) % 3 === 0) stamp(g, SPARK4, { W: i % 2 ? "#FFCB05" : "#FFFFFF" }, x, y); });
  }
  return toSvg(g);
}
const BUILD_DELAYS = Array.from({ length: BUILD_FRAMES }, (_, t) =>
  t < BUILD_TRACE ? 70 : t < BUILD_TRACE + BUILD_FILL ? 120 : t < BUILD_TRACE + BUILD_FILL + BUILD_DROP.length ? 70 : t === BUILD_FRAMES - 1 ? 900 : 120);

// 5. train: the chain of blocks. A conductor cat rides a train of Arc-blue block cars, each with a
// gold check (final), through an Arc-blue night; hills and rails scroll past.
const CAP = outlined([
  "....BBBBBB....",
  "..LBBBBBBBBB..",
  ".LBBBBBGGBBBB.",
  ".LBBBBBGGBBBB.",
  "kkkkkkkkkkkkkk",
  ".vvvvvvvvvv...",
]);
const CAP_PAL = { O: "#050A1C", B: "#2E4183", L: "#4E66B8", G: "#FFCB05", k: "#0C1A3E", v: "#050A1C" };
const TRAIN_FRAMES = 20;
let tseed = 11;
const trnd = () => { tseed = (tseed * 1664525 + 1013904223) % 4294967296; return tseed / 4294967296; };
const TSTARS = Array.from({ length: 36 }, () => ({ x: Math.floor(trnd() * N), y: Math.floor(trnd() * 26), gold: trnd() < 0.2 }));
const hill = (x, period, base, amp) => base - Math.round(amp * (0.6 * Math.sin((2 * Math.PI * x) / period) + 0.4 * Math.sin((4 * Math.PI * x) / period + 1)));

function car(g, x0, top, bob, t) {
  const W = 22, H = 12, y0 = top + bob;
  for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) {
    const edge = x === x0 || x === x0 + W - 1 || y === y0 || y === y0 + H - 1;
    put(g, x, y, edge ? "#050A1C" : y === y0 + 1 ? "#8FAAF0" : x === x0 + W - 2 || y === y0 + H - 2 ? "#2E4183" : "#4E66B8");
  }
  stamp(g, CHECK7, { Y: "#FFCB05" }, x0 + 7, y0 + 3);
  // Wheels: two each, the spokes turning
  for (const wx of [x0 + 5, x0 + W - 6]) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const d = Math.hypot(x, y);
      if (d < 2.6) put(g, wx + x, y0 + H + 1 + y, d > 1.6 ? "#050A1C" : "#8FAAF0");
    }
    const sp = t % 2 ? [[-1, -1], [1, 1]] : [[-1, 1], [1, -1]];
    for (const [x, y] of sp) put(g, wx + x, y0 + H + 1 + y, "#2E4183");
    put(g, wx, y0 + H + 1, "#FFCB05");
  }
}

function trainFrame(t) {
  const g = grid();
  // Sunset: violet at the top, through rose and orange to gold on the horizon
  const sky = ["#2A1450", "#4A1E66", "#7A2A6E", "#B03C66", "#E0603F", "#F08A2A", "#FFB020"];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y][x] = sky[Math.min(6, Math.floor(y / 5))];
  // A big low sun, its core paler
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - 44, y - 31);
    if (d < 9.5) g[y][x] = d < 5 ? "#FFF8E7" : d < 7.5 ? "#FFE680" : "#FFCB05";
  }
  // Two birds gliding
  for (const [bx, by] of [[12 - (t % 20) * 0.3, 10], [20 - (t % 20) * 0.3, 14]]) {
    const up = t % 4 < 2;
    for (const [x, y] of [[0, 0], [1, 1], [2, up ? 0 : 1], [3, 1], [4, 0]]) put(g, bx + x, by + y - (up && (x === 0 || x === 4) ? 1 : 0), "#3A1240");
  }
  // Two hill layers: far mountains drift 1 px a frame (period 20), near hills 3 px (period 30)
  for (let x = 0; x < N; x++) {
    const far = hill(x + t, 20, 34, 3), near = hill(x + t * 3, 30, 42, 4);
    for (let y = far; y < N; y++) g[y][x] = y === far ? "#C0608A" : "#8A3A7A";
    for (let y = near; y < N; y++) g[y][x] = y === near ? "#7A3A6A" : y === near + 1 ? "#5A2A5A" : "#3A1A44";
  }
  // Rails catching the low sun, sleepers scrolling 3 px a frame
  for (let x = 0; x < N; x++) {
    for (let y = 53; y < N; y++) g[y][x] = "#2A1030";
    put(g, x, 53, "#FFCB05"); put(g, x, 54, "#C47A00");
    if (((x + t * 3) % 6 + 6) % 6 < 2) { put(g, x, 55, "#5A2A3A"); put(g, x, 56, "#5A2A3A"); }
  }
  const bob = t % 5 === 0 ? 1 : 0; // a bump at every rail joint
  const TOP = 38;
  car(g, -14, TOP, bob, t);
  car(g, 19, TOP, bob, t);
  car(g, 52, TOP, bob, t);
  for (const cx of [8, 41]) for (const y of [TOP + 8, TOP + 9]) for (let x = cx; x < cx + 11; x++) put(g, x, y + bob, "#050A1C"); // couplers
  // The conductor on the middle car, cap on
  const CX = 14, CY = TOP - 31 + bob;
  stamp(g, cat({ closed: t === 14 }), PAL, CX, CY);
  stamp(g, CAP, CAP_PAL, CX + 8, CY + 2);
  return toSvg(g);
}

// 6. rain: fees in dollars on Arc. A cat in a top hat, monocle and bow tie under a spotlight while
// blank blue coins (no USDC logo) spin down in front of and behind it; neat coin stacks on the floor.
const TOPHAT = outlined([
  "...KKKKKKKK...",
  "...KkKKKKKK...",
  "...KkKKKKKK...",
  "...KkKKKKKK...",
  "...BBBBBBBB...",
  "...bbbbbbbb...",
  "...KkKKKKKK...",
  "KKKKKKKKKKKKKK",
]);
const TOPHAT_PAL = { O: "#050A1C", K: "#141428", k: "#3A3A5A", B: "#4E66B8", b: "#2E4183" };
const BOWTIE = outlined(["BB...BB", "BBBkBBB", "BB...BB"]);
const BOWTIE_PAL = { O: "#050A1C", B: "#4E66B8", k: "#FFCB05" };
const COINS = [
  ["..OOOO..", ".OLLLbO.", "OLWLbbbO", "OLLbbbsO", "OLbbbbsO", "ObbbbssO", ".ObbssO.", "..OOOO.."],
  ["...OO...", "..OLbO..", "..OLbO..", "..ObbO..", "..ObbO..", "..ObsO..", "..ObsO..", "...OO..."],
  ["...OO...", "...LO...", "...LO...", "...bO...", "...bO...", "...sO...", "...sO...", "...OO..."],
];
const COIN_SPIN = [0, 1, 2, 1];
const BLUE_COIN = { O: "#0C1A3E", W: "#FFFFFF", L: "#C9D6FF", b: "#6A86D8", s: "#4E66B8" };
const RAIN_FRAMES = 24;
let rseed = 5;
const rrnd = () => { rseed = (rseed * 1664525 + 1013904223) % 4294967296; return rseed / 4294967296; };
const DROPS = Array.from({ length: 13 }, (_, i) => ({ x: 1 + Math.floor(rrnd() * 51), y0: Math.floor(rrnd() * 72), ph: Math.floor(rrnd() * 4), front: false }));
for (const d of DROPS) d.front = d.x < 10 || d.x > 46; // in front only at the sides, never over the face
const STACK = ["OOOOOOO", "LLLLLLL", "bbbbbbb", "OOOOOOO"];

function rainFrame(t) {
  const g = grid();
  // A red velvet stage: dark back wall, a warm spotlight cone
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y][x] = y < 20 ? "#2A0610" : y < 38 ? "#340814" : "#3E0A18";
  for (let y = 0; y < 52; y++) for (let x = 0; x < N; x++) if (Math.abs(x - 29.5) < 8 + y * 0.32) g[y][x] = y % 2 ? "#5A1424" : "#541220";
  // Wooden stage floor with a gold pool of light
  for (let y = 52; y < N; y++) for (let x = 0; x < N; x++) g[y][x] = y === 52 ? "#C47A00" : (x + (y % 2) * 7) % 14 === 0 ? "#4A2600" : y % 3 === 0 ? "#6A3800" : "#7A4200";
  for (let y = 53; y < N; y++) for (let x = 0; x < N; x++) if (((x - 29.5) / 24) ** 2 + ((y - 56) / 3.6) ** 2 < 1) g[y][x] = y % 3 === 0 ? "#C47A00" : "#E08A00";
  // Curtains, tied back at a gold rope: velvet folds in stripes
  const FOLDS = ["#5A0A18", "#8A1424", "#B01E30", "#D8343F", "#B01E30", "#8A1424"];
  for (let y = 0; y < 53; y++) {
    const w = y < 34 ? 6 + Math.round(((34 - y) / 34) * 6) : 6 + Math.round(((y - 34) / 18) * 5);
    for (let x = 0; x < w; x++) { put(g, x, y, FOLDS[(x + 1) % 6]); put(g, N - 1 - x, y, FOLDS[(x + 1) % 6]); }
    put(g, w, y, "#2A0610"); put(g, N - 1 - w, y, "#2A0610");
  }
  for (const side of [0, 1]) for (let i = 0; i < 8; i++) {
    const x = side ? N - 1 - i : i;
    put(g, x, 33, "#FFCB05"); put(g, x, 34, "#C47A00");
    if (i === 6) for (let k = 0; k < 4; k++) put(g, x, 35 + k, k === 3 ? "#C47A00" : "#FFCB05");
  }
  // Valance across the top, scalloped, with a gold fringe
  for (let x = 0; x < N; x++) {
    const sc = 4 + Math.round(2 * Math.sin(((x % 10) / 10) * Math.PI));
    for (let y = 0; y < sc; y++) put(g, x, y, FOLDS[(x + 3) % 6]);
    put(g, x, sc, "#FFCB05"); if (x % 2 === 0) put(g, x, sc + 1, "#C47A00");
  }
  const coin = (d) => {
    const y = ((d.y0 + t * 3) % 72) - 12;
    if (y < 50) stamp(g, COINS[COIN_SPIN[(t + d.ph) % 4]], BLUE_COIN, d.x, y);
  };
  for (const d of DROPS) if (!d.front) coin(d);
  // Coin stacks: stable, they don't move
  for (const [sx, n] of [[3, 5], [10, 3], [44, 4], [51, 6]]) for (let i = 0; i < n; i++) stamp(g, STACK, { O: "#0C1A3E", L: "#C9D6FF", b: "#6A86D8" }, sx, 54 - i * 3);
  const CX = 14, CY = 22;
  stamp(g, cat({ closed: t === 18 }), PAL, CX, CY);
  stamp(g, TOPHAT, TOPHAT_PAL, CX + 8, CY - 6);
  stamp(g, BOWTIE, BOWTIE_PAL, CX + 12, CY + 19);
  // Monocle on its left eye, with a little chain
  for (let y = 10; y <= 18; y++) for (let x = 16; x <= 25; x++) if (Math.abs(Math.hypot(x - 20.5, y - 14) - 3) < 0.55) put(g, CX + x, CY + y, "#FFCB05");
  for (const [x, y] of [[23, 17], [24, 18], [24, 19], [25, 20]]) put(g, CX + x, CY + y, "#C47A00");
  if (t % 8 < 2) put(g, CX + 18, CY + 12, "#FFFFFF");
  for (const d of DROPS) if (d.front) coin(d);
  return toSvg(g);
}

const GIFS = [
  { name: "gm", frames: 12, draw: gmFrame, delay: () => 130 },
  { name: "wagmi", frames: WAGMI_FRAMES, draw: wagmiFrame, delay: (t) => WAGMI_DELAYS[t] },
  { name: "lfg", frames: LFG_FRAMES, draw: lfgFrame, delay: () => 80 },
  { name: "build", n: 75, frames: BUILD_FRAMES, draw: buildFrame, delay: (t) => BUILD_DELAYS[t] },
  { name: "train", frames: TRAIN_FRAMES, draw: trainFrame, delay: () => 80 },
  { name: "rain", frames: RAIN_FRAMES, draw: rainFrame, delay: () => 90 },
];
const only = process.argv[2];

for (const gif of GIFS) {
  if (only && only !== gif.name) continue;
  N = gif.n ?? 60;
  const frames = [];
  for (let t = 0; t < gif.frames; t++) frames.push(await sharp(Buffer.from(gif.draw(t))).png().toBuffer());
  // A still of the most telling frame, for checking (and for posting as an image)
  const stillAt = gif.name === "wagmi" ? DROP.length + 4 : gif.name === "build" ? BUILD_FRAMES - 2 : 0;
  writeFileSync(join(HERE, `pikamd-react-${gif.name}.png`), frames[stillAt]);
  await sharp(frames, { join: { animated: true } })
    .gif({ loop: 0, delay: Array.from({ length: gif.frames }, (_, t) => gif.delay(t)), dither: 0, effort: 10 })
    .toFile(join(HERE, `pikamd-react-${gif.name}.gif`));
  console.log(`pikamd-react-${gif.name}.gif  ${gif.frames} frames`);
}
