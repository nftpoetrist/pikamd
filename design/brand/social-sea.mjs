// PikaMd X image "A sea of guidelines" (2026-11-03): Explore's pixel sea (web/components/explore/ArcSea.tsx:
// the same surface tile, foam lines and stepped Arc blues) under a night sky, with .md pages
// floating in it. The gold cat rides a big .md page like a raft; the pages on the surface carry
// the guideline kinds' colors, deeper ones fade into the blue with rising bubbles.
//   design/brand/pikamd-x-sea.png  1600×900 (git-ignored: uploaded to X by hand)
//
//   node --experimental-strip-types design/brand/social-sea.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../../web");
const { PIKA, PIKA_PALETTE } = await import(join(WEB, "components/brand/pika-art.ts"));

const W = 1600, H = 900;
const P = 3; // one sea pixel in px, as on Explore
const SEA_Y = 520; // top of the surface crest row

const svg = (rows, colors, scale, extra = "") => {
  const w = rows[0].length, h = rows.length;
  let rects = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== "." && colors[ch]) rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${colors[ch]}"/>`;
      x = end;
    }
  });
  return `<svg ${extra} width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
};

// ── The sea, from ArcSea.tsx ─────────────────────────────────────────────────────────────────
const SURFACE = { width: 64, rows: 8, body: "#2E4183", foam: "#6A86D8", lit: "#8FAAF0", cap: "#EEF2FF" };
const FOAM = [
  { width: 64, phase: 0.6, line: "#4E66B8", cap: "#8FAAF0" },
  { width: 80, phase: 2.3, line: "#3A54A0", cap: "#6A86D8" },
];
const FOAM_ROWS = 16;
const svgUrl = (w, h, rects) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${rects.join("")}</svg>`)}")`;
const px = (x, y, fill, h = 1) => `<rect x="${x}" y="${y}" width="1" height="${h}" fill="${fill}"/>`;
function profile(width, phase, lo, hi) {
  return Array.from({ length: width }, (_, x) => {
    const t = (2 * Math.PI * x) / width;
    const v = 0.5 + 0.32 * Math.sin(t + phase) + 0.18 * Math.sin(3 * t + 2 * phase);
    return Math.max(lo, Math.min(hi, Math.round(lo + v * (hi - lo))));
  });
}
function surfaceTile() {
  const { width, rows, body, foam, lit, cap } = SURFACE;
  const h = profile(width, 0, 1, rows - 1);
  const rects = [];
  for (let x = 0; x < width; x++) {
    const top = rows - h[x];
    const prev = h[(x - 1 + width) % width];
    const next = h[(x + 1) % width];
    rects.push(px(x, top, body, rows - top));
    rects.push(px(x, top, h[x] >= prev && h[x] > next && h[x] >= 5 ? cap : foam));
    if (h[x] > prev && top + 1 < rows) rects.push(px(x, top + 1, lit));
  }
  return svgUrl(width, rows, rects);
}
function foamTile(f) {
  const h = profile(f.width, f.phase, 0, 3);
  const rects = [];
  for (let x = 0; x < f.width; x++) {
    const prev = h[(x - 1 + f.width) % f.width];
    const next = h[(x + 1) % f.width];
    const y = 4 - h[x];
    if ((x + Math.round(f.phase * 10)) % 21 > 17) continue;
    rects.push(px(x, y, h[x] >= prev && h[x] > next && h[x] === 3 ? f.cap : f.line));
  }
  return svgUrl(f.width, FOAM_ROWS, rects);
}

// ── Pages: the mascot's .md page, as a map ───────────────────────────────────────────────────
// X paper, x shade, f fold, l text lines, H the kind's band (the file name is written on it)
function page(w, h, lines) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) g[y][x] = "X";
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5 - i; j++) g[1 + i][w - 2 - j] = "."; // cut corner
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) g[2 + i][w - 6 + j] = "f"; // fold
  for (let y = 1; y < h - 1; y++) if (g[y][w - 2] === "X") g[y][w - 2] = "x";
  for (let x = 1; x < w - 1; x++) if (g[h - 2][x] === "X") g[h - 2][x] = "x";
  for (let y = 7; y <= 11; y++) for (let x = 2; x <= w - 3; x++) g[y][x] = "H";
  lines.forEach((len, i) => { for (let x = 3; x < 3 + len && x < w - 3; x++) g[14 + i * 3][x] = "l"; });
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== "." && g[y][x] !== "O";
  const ink = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
  for (const [x, y] of ink) g[y][x] = "O";
  return g.map((r) => r.join(""));
}
const PAPER = { O: "#1A0800", X: "#FFF8E7", x: "#E9D9B4", f: "#D6C08E", l: "#B08A4A" };
// The kinds' colors, as on the X header's icons (social-icons.mjs) and the card badges
const KIND = { rules: "#FFCB05", skill: "#3FBF7F", agent: "#9FB3E6", prompt: "#9B7BE0", guide: "#F0A500" };
// Deep pages: the same page in the sea's blues
const DEEP = { O: "#0C1A3E", X: "#4E66B8", x: "#3A54A0", f: "#3A54A0", l: "#2E4183", H: "#6A86D8" };
const DEEPER = { O: "#0C1A3E", X: "#2E4183", x: "#25397A", f: "#25397A", l: "#1C3272", H: "#3A54A0" };

const SMALL = page(24, 30, [16, 12, 15, 9]);
const RAFT = page(46, 30, [34, 26, 38, 20]);
const DEEP_PAGE = page(18, 24, [10, 8, 11]);

// A floating page: drawn, then the water in front of its lower part (a translucent sea layer
// with a foam line on top), so it sits in the surface rather than on it
const floatPage = ({ x, top, name, kind, map = SMALL, scale = 4, water }) => {
  const pw = map[0].length * scale, ph = map.length * scale;
  const label = name ? `<span class="pname" style="left:${2 * scale}px;top:${7 * scale}px;width:${(map[0].length - 4) * scale}px;height:${5 * scale}px">${name}</span>` : "";
  return `<div class="float" style="left:${x}px;top:${top}px;width:${pw}px;height:${ph}px">
    ${svg(map, { ...PAPER, H: KIND[kind] }, scale)}${label}
  </div>
  <div class="front" style="left:${x - 12}px;top:${water}px;width:${pw + 24}px;height:${top + ph - water + 6}px"></div>`;
};

// Bubbles: tiny pixel rings rising from the deep pages
const BUBBLE = [".O.", "O.O", ".O."];
const bubbles = (x, y, n) => Array.from({ length: n }, (_, i) =>
  `<div class="bubble" style="left:${x + (i % 2 ? 9 : 0)}px;top:${y - i * 26}px;opacity:${(0.85 - i * 0.18).toFixed(2)}">${svg(BUBBLE, { O: "#8FAAF0" }, 3)}</div>`).join("");

// The moon: a cream pixel disc with a shaded crescent edge
const MOON = (() => {
  const N = 17, c = 8, r = 7.6, g = [];
  for (let y = 0; y < N; y++) {
    let row = "";
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > r) row += ".";
      else if (d > r - 1.2) row += "O";
      else if (Math.hypot(x - c - 2.2, y - c + 2.2) > r - 0.6) row += "s";
      else row += (x === 6 && y === 9) || (x === 10 && y === 5) || (x === 11 && y === 11) ? "c" : "m";
    }
    g.push(row);
  }
  return g;
})();

// Seeded stars, kept off the title
let seed = 20261103;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const clear = (x, y) => y < SEA_Y - 30 && !(x < 900 && y > 40 && y < 330) && !(x > 1370 && x < 1540 && y > 40 && y < 200) && !(x > 1140 && x < 1400 && y > 330);
const stars = Array.from({ length: 70 }, () => {
  let x, y;
  do { x = Math.round(rnd() * W / 3) * 3; y = Math.round(rnd() * SEA_Y / 3) * 3; } while (!clear(x, y));
  const gold = rnd() < 0.2, size = rnd() < 0.15 ? 6 : 3;
  return `<i class="star" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${gold ? "#FFCB05" : "#C9D6FF"};opacity:${(0.25 + rnd() * 0.55).toFixed(2)}"></i>`;
}).join("");

// The moon's reflection: short dashes on the water under it
const MOON_X = 1400, MOON_Y = 70;
const reflection = Array.from({ length: 9 }, (_, i) => {
  const w = [60, 48, 66, 36, 54, 30, 42, 24, 30][i];
  return `<i class="refl" style="left:${MOON_X + 51 - w / 2}px;top:${SEA_Y + 36 + i * 15}px;width:${w}px;opacity:${(0.7 - i * 0.06).toFixed(2)}"></i>`;
}).join("");

const surfacePages = [
  { x: 110, top: SEA_Y - 64, name: "CLAUDE.md", kind: "rules" },
  { x: 300, top: SEA_Y - 44, name: "SKILL.md", kind: "skill" },
  { x: 490, top: SEA_Y - 72, name: "AGENTS.md", kind: "agent" },
  { x: 680, top: SEA_Y - 52, name: "prompt.md", kind: "prompt" },
  { x: 870, top: SEA_Y - 66, name: "guide.md", kind: "guide" },
].map((p) => floatPage({ ...p, water: SEA_Y + 14 })).join("");

const RAFT_X = 1150, RAFT_TOP = SEA_Y - 50;
const deep = [
  [210, 660, DEEP, 3], [420, 730, DEEPER, 3], [600, 640, DEEP, 3], [820, 710, DEEPER, 3], [1040, 650, DEEP, 3], [1290, 720, DEEPER, 3], [1500, 650, DEEPER, 2], [70, 760, DEEPER, 2], [1130, 760, DEEPER, 2],
].map(([x, y, pal, s]) => `<div class="deep" style="left:${x}px;top:${y}px">${svg(DEEP_PAGE, pal, s)}</div>${s === 3 ? bubbles(x + 22, y - 18, 3) : ""}`).join("");

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Jersey+10&family=VT323&display=block" rel="stylesheet">`;
const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; }
  body { position: relative; overflow: hidden; background: #050A1C; color: #FFF8E7; }
  .sky { position: absolute; left: 0; right: 0; top: 0; height: ${SEA_Y + 30}px; background:
      repeating-linear-gradient(0deg, rgba(143,170,240,.035) 0 1px, transparent 1px 4px),
      radial-gradient(ellipse 30% 60% at ${MOON_X + 51}px 120px, rgba(201,214,255,.13) 0%, transparent 70%),
      linear-gradient(180deg, #050A1C 0%, #0A1534 55%, #142658 100%); }
  .grid { position: absolute; left: 0; right: 0; top: 0; height: ${SEA_Y}px; background-image:
      linear-gradient(rgba(143,170,240,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(143,170,240,.045) 1px, transparent 1px);
    background-size: 40px 40px; }
  .star { position: absolute; }
  .moon { position: absolute; left: ${MOON_X}px; top: ${MOON_Y}px; filter: drop-shadow(0 0 40px rgba(238,242,255,.45)); }

  .water { position: absolute; left: 0; right: 0; top: ${SEA_Y}px; bottom: 0; background: linear-gradient(180deg,
      #2E4183 0 36px, #25397A 36px 26%, #1C3272 26% 52%, #142658 52% 78%, #0C1A3E 78% 100%); }
  /* Foam stops above the footer line, so the text there stays clean */
  .foam { position: absolute; left: 0; right: 0; top: ${SEA_Y + 24}px; bottom: 84px; background-repeat: repeat; }
  .surface { position: absolute; left: 0; right: 0; top: ${SEA_Y}px; height: ${SURFACE.rows * P}px; background-repeat: repeat-x;
    background-image: ${surfaceTile()}; background-size: ${64 * P}px ${SURFACE.rows * P}px; }
  .foam-0 { background-image: ${foamTile(FOAM[0])}; background-size: ${64 * P}px ${FOAM_ROWS * P}px; }
  .foam-1 { top: ${SEA_Y + 48}px; background-image: ${foamTile(FOAM[1])}; background-size: ${80 * P}px ${FOAM_ROWS * P}px; background-position: -90px 0; }
  .refl { position: absolute; height: 3px; background: #C9D6FF; }
  .deep, .bubble { position: absolute; }

  .float { position: absolute; filter: drop-shadow(3px 3px 0 rgba(5,10,28,.6)); }
  .float svg { display: block; }
  .pname { position: absolute; display: flex; align-items: center; justify-content: center; font: 17px/1 VT323, monospace; color: #1A0800; letter-spacing: .5px; }
  /* The sea in front of a floating page's lower part, with a foam line on its top edge */
  .front { position: absolute; background:
      linear-gradient(90deg, transparent 0 3px, #8FAAF0 3px 15px, transparent 15px 21px, #EEF2FF 21px 30px, transparent 30px 36px, #6A86D8 36px 60%, transparent 60% calc(60% + 6px), #8FAAF0 calc(60% + 6px) calc(100% - 3px), transparent calc(100% - 3px)) 0 0 / 100% 3px no-repeat,
      linear-gradient(180deg, rgba(46,65,131,.86) 0 22px, rgba(37,57,122,.88) 22px); }
  .cat { position: absolute; left: ${RAFT_X + 44}px; top: ${RAFT_TOP - 120}px; filter: drop-shadow(0 0 30px rgba(255,203,5,.45)); }

  .head { position: absolute; left: 70px; top: 56px; }
  .tag { display: inline-block; padding: 7px 16px 5px; font: 24px/1 VT323, monospace; letter-spacing: 3px; color: #1A0800; background: #FFCB05;
    box-shadow: 0 -3px 0 #1A0800, 0 3px 0 #1A0800, -3px 0 0 #1A0800, 3px 0 0 #1A0800, inset 0 -3px 0 #C47A00; }
  .head h1 { margin-top: 20px; font: 400 100px/0.88 "Jersey 10", monospace; letter-spacing: 1px; text-shadow: 5px 5px 0 #050A1C; }
  .head h1 span { color: #FFCB05; text-shadow: 5px 5px 0 #7A4200; }
  .head p { margin-top: 18px; font: 32px/1.15 VT323, monospace; color: #C9D6FF; text-shadow: 2px 2px 0 #050A1C; }

  .foot { position: absolute; left: 70px; right: 70px; bottom: 30px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline;
    font: 26px/1 VT323, monospace; color: #8FAAF0; letter-spacing: 1px; text-shadow: 2px 2px 0 #050A1C; }
  .foot b { font: 400 38px/1 "Jersey 10", monospace; color: #FFF8E7; letter-spacing: 1px; }
  .foot b span { color: #FFCB05; }
  .foot > :last-child { justify-self: end; }
</style></head><body>
  <div class="sky"></div><div class="grid"></div>${stars}
  <div class="moon">${svg(MOON, { O: "#8D9BC2", m: "#EEF2FF", s: "#C9D3EE", c: "#C9D3EE" }, 6)}</div>

  <div class="water"></div>
  <div class="foam foam-0"></div>
  <div class="foam foam-1"></div>
  ${deep}
  <div class="surface"></div>
  ${reflection}

  <div class="cat">${svg(PIKA, PIKA_PALETTE, 4)}</div>
  ${floatPage({ x: RAFT_X, top: RAFT_TOP, kind: "rules", map: RAFT, scale: 4, water: SEA_Y + 14, name: "my-collection.md" })}
  ${surfacePages}

  <div class="head">
    <span class="tag">EXPLORE THE LIBRARY</span>
    <h1>A sea of<br><span>guidelines</span></h1>
    <p>Rules, skills and prompts shared by the community<br>Save the ones you like, your agent reads them over MCP</p>
  </div>

  <div class="foot"><b>Pika<span>Md</span></b><span>Recorded on Arc · free to read</span><span>pikamd.vercel.app/explore</span></div>
</body></html>`;

async function render(html, width, height, out) {
  const work = mkdtempSync(join(tmpdir(), "pikamd-social-"));
  const file = join(work, "page.html");
  writeFileSync(file, html);
  const port = 9480 + Math.floor(Math.random() * 15);
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, "profile")}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
    const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === "page");
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0; const pend = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "file://" + file });
    await new Promise((r) => setTimeout(r, 2500));
    await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    const fonts = await send("Runtime.evaluate", { expression: "[document.fonts.check('34px VT323'), document.fonts.check('34px \\'Jersey 10\\'')].join(' ')", returnByValue: true });
    console.log("fonts loaded (VT323, Jersey 10):", fonts.result.result.value);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    ws.close();
  } finally {
    await new Promise((r) => { chrome.once("exit", r); chrome.kill("SIGKILL"); });
    try { rmSync(work, { recursive: true, force: true }); } catch { /* left in the temp dir */ }
  }
}

await render(html, W, H, join(HERE, "pikamd-x-sea.png"));
console.log("pikamd-x-sea.png");
