// PikaMd background: a warm pile of PikaMd's own collectible cards (the mascot, PikaGold coins,
// sparkles, guideline files, feature cards), lit from the center, with depth of field.
// Everything drawn here is PikaMd's own art: the pixel maps come straight from the site's
// components, so the background matches the UI. Deterministic (seeded), so it can be rebuilt.
//
//   node --experimental-strip-types design/brand/background.mjs <out.png> <out.webp>
//
// Renders an HTML scene in headless Chrome at 1440×708 CSS px, device scale 2 (2880×1416).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.PIKAMD_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = join(ROOT, "web");
const require = createRequire(join(WEB, "package.json"));
const sharp = require("sharp");
const [outPng, outWebp] = process.argv.slice(2);

// ── Pixel maps, read from the site's own components ───────────────────────────────────────
const { PIKA, PIKA_PALETTE } = await import(join(WEB, "components/brand/pika-art.ts"));
const src = (f) => readFileSync(join(WEB, f), "utf8");
const arrayIn = (text, name) => {
  const m = text.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`no ${name}`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
};
const colorsIn = (text, name) => {
  const m = text.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(`no ${name}`);
  return Object.fromEntries([...m[1].matchAll(/(\w)\s*:\s*"(#[0-9A-Fa-f]{6})"/g)].map((x) => [x[1], x[2]]));
};
const coinSrc = src("components/PikaGoldCoin.tsx");
const COIN = arrayIn(coinSrc, "MAP"), COIN_COLORS = colorsIn(coinSrc, "COLORS");
const blocksSrc = src("components/PixelBlocks.tsx");
const BLOCKS = arrayIn(blocksSrc, "BLOCKS"), BLOCKS_COLORS = colorsIn(blocksSrc, "BLOCKS_COLORS");
const heartSrc = src("components/PixelHeart.tsx");
const HEART_SHAPE = arrayIn(heartSrc, "HEART");
// The heart component shades its shape at render time; same rule here: outline, light top-left, shade bottom-right
const HEART = (() => {
  const H = HEART_SHAPE.length + 2, W = HEART_SHAPE[0].length + 2;
  const on = (x, y) => HEART_SHAPE[y - 1]?.[x - 1] === "#";
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (on(x, y)) {
      if (!on(x - 1, y) || !on(x, y - 1)) return "L";
      if (!on(x + 1, y) || !on(x, y + 1)) return "S";
      return "F";
    }
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => on(x + a, y + b)) ? "O" : ".";
  }).join(""));
})();
const HEART_COLORS = { O: "#2A0712", L: "#FF9DB8", F: "#FF4F7E", S: "#B8204A" };
// 4-point sparkle (astroid), 19×19 with an outline
const SPARK = (() => {
  const N = 19, R = 8.2, c = 9;
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  const inside = (x, y) => (Math.abs(x - c) / R) ** (2 / 3) + (Math.abs(y - c) / R) ** (2 / 3) <= 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x, y)) {
    const d = Math.hypot(x - c, y - c);
    g[y][x] = d < 1.2 ? "W" : d < 2.6 ? "L" : x <= c && y <= c ? "Y" : "G";
  }
  const solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && g[y][x] !== "." && g[y][x] !== "O";
  const ink = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(x + a, y + b))) ink.push([x, y]);
  for (const [x, y] of ink) g[y][x] = "O";
  return { rows: g.map((r) => r.join("")), palette: { O: "#1A0800", W: "#FFFFFF", L: "#FFF1C2", Y: "#FFD740", G: "#F0A500" } };
})();

const svg = (rows, colors, scale) => {
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
  return `<svg width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
};

// ── Seeded randomness ─────────────────────────────────────────────────────────────────────
let seed = 0x9e3779b9 ^ 20261015;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);

// ── Card templates ────────────────────────────────────────────────────────────────────────
// Generic guideline names only: no third-party product names in our own artwork
const TITLES = [
  ["Secure Contracts", "secure-contracts", "RULES"], ["Clean Commits", "clean-commits", "RULES"], ["Test First", "test-first", "SKILL"],
  ["API Design", "api-design", "GUIDE"], ["UI Rules", "ui-rules", "RULES"], ["Style Guide", "style-guide", "GUIDE"],
  ["Code Review", "code-review", "AGENT"], ["Docs Writer", "docs-writer", "AGENT"], ["SQL Safety", "sql-safety", "RULES"],
  ["Branch Flow", "branch-flow", "GUIDE"], ["Prompt Craft", "prompt-craft", "PROMPT"], ["Type Safety", "type-safety", "RULES"],
  ["Refactor Kit", "refactor-kit", "SKILL"], ["Perf Budget", "perf-budget", "GUIDE"], ["A11y Check", "a11y-check", "SKILL"],
  ["Bug Hunter", "bug-hunter", "AGENT"], ["Release Notes", "release-notes", "PROMPT"], ["Error Handling", "error-handling", "GUIDE"],
];
const lines = (n, cls = "ln") => Array.from({ length: n }, () => `<i class="${cls}" style="width:${Math.round(between(48, 96))}%"></i>`).join("");

function pikaCard(n) {
  const [title, , kind] = pick(TITLES);
  return `<div class="card gold"><div class="in in-gold">
    <div class="hd"><b>${title}</b><em>${kind}</em></div>
    <div class="art art-gold">${svg(PIKA, PIKA_PALETTE, 3)}</div>
    <div class="txt">${lines(3, "ln ln-dark")}</div>
    <div class="ft"><span>PikaMd</span><span>No. ${String(n).padStart(3, "0")} ✦</span></div>
  </div></div>`;
}
function sparkCard() {
  return `<div class="card gold"><div class="in in-spark">
    <div class="hd"><em>SPARK</em></div>
    <div class="spark">${svg(SPARK.rows, SPARK.palette, 5)}</div>
    <div class="ft"><span>PikaMd</span><span>✦</span></div>
  </div></div>`;
}
function fileCard() {
  const [title, slug, kind] = pick(TITLES);
  return `<div class="card gold"><div class="in in-file">
    <div class="hd file"><span>${slug}.md</span><em>${kind}</em></div>
    <b class="ttl">${title}</b>
    <div class="txt">${lines(4)}</div>
    <div class="tags"><i></i><i></i></div>
    <div class="btns"><i class="open"></i><i></i><i></i><i class="wide"></i></div>
  </div></div>`;
}
function featureCard(theme) {
  const art = theme === "violet" ? svg(COIN, COIN_COLORS, 5) : theme === "navy" ? svg(BLOCKS, BLOCKS_COLORS, 3) : svg(HEART, HEART_COLORS, 6);
  const [title] = pick(TITLES);
  return `<div class="card ${theme === "navy" ? "silver" : "gold"}"><div class="in in-${theme}">
    <div class="hd"><b>${title}</b><span class="plq">${pick(["0%", "100%", "0.5s", "1", "USDC"])}</span></div>
    <div class="art art-${theme}">${art}</div>
    <div class="rib">${pick(["Owned by the community", "Recorded on Arc Network", "Wallet to wallet", "Collected by you"])}</div>
    <div class="perks">${lines(2, "ln ln-light")}${lines(2, "ln ln-light")}</div>
  </div></div>`;
}
// The Arc blues of the plaque's running cat (web/components/brand/run-cat.ts → RUN_BLUE)
const ARC_PALETTE = { ...PIKA_PALETTE, O: "#050A1C", K: "#050A1C", D: "#2E4183", S: "#4E66B8", M: "#6A86D8", B: "#8FAAF0", L: "#C9D6FF", C: "#EEF2FF" };
// The full mascot in PikaMd gold and Arc blue, split down the middle of the face (either way round),
// or all blue. Picked by card number, so it draws no random numbers and the layout stays the same.
function splitCat(left, right, scale) {
  const w = PIKA[0].length, h = PIKA.length;
  let rects = "";
  PIKA.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${(x < w / 2 ? left : right)[ch]}"/>`;
  }));
  return `<svg width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}
const HEAD_VARIANTS = [[PIKA_PALETTE, ARC_PALETTE], [ARC_PALETTE, PIKA_PALETTE], [ARC_PALETTE, ARC_PALETTE]];
// No. 061 is the sharp card at the front on the left: all Arc blue (user request 2026-10-25)
const ALL_ARC = new Set([61]);
function headCard(n) {
  const [left, right] = ALL_ARC.has(n) ? [ARC_PALETTE, ARC_PALETTE] : HEAD_VARIANTS[n % HEAD_VARIANTS.length];
  return `<div class="card gold"><div class="in in-head">
    <div class="hd"><b>PikaMd</b><em>No. ${String(n).padStart(3, "0")}</em></div>
    <div class="art art-head">${splitCat(left, right, 3)}</div>
    <div class="txt">${lines(2, "ln ln-dark")}</div>
  </div></div>`;
}
function coinCard() {
  return `<div class="card gold"><div class="in in-coin">
    <div class="hd"><b>PikaGold</b><em>GOLD</em></div>
    <div class="art art-coin">${svg(COIN, COIN_COLORS, 6)}</div>
    <div class="txt">${lines(2, "ln ln-dark")}</div>
  </div></div>`;
}

const makers = [
  [pikaCard, 6], [sparkCard, 3], [fileCard, 5], [() => featureCard("violet"), 2], [() => featureCard("navy"), 2],
  [() => featureCard("emerald"), 2], [headCard, 3], [coinCard, 2],
];
const weighted = makers.flatMap(([f, w]) => Array(w).fill(f));

// ── Layout: three depth layers over a 1440×708 stage ─────────────────────────────────────
const W = 1440, H = 708;
const cards = [];
let n = 1;
const layer = (count, sMin, sMax, blur, bright, zBase, spreadX = 1, spreadY = 1) => {
  for (let i = 0; i < count; i++) {
    const s = between(sMin, sMax);
    // stratified x so the pile covers the whole width
    const cx = ((i + rnd()) / count) * W * spreadX + (W * (1 - spreadX)) / 2;
    const cy = between(-0.16, 1.06) * H * spreadY + (H * (1 - spreadY)) / 2;
    const rot = between(-34, 34);
    // brighter toward the center of the stage
    const d = Math.hypot((cx - W / 2) / (W / 2), (cy - H * 0.42) / (H / 2));
    const b = bright * (1.12 - Math.min(0.42, d * 0.28));
    cards.push({ html: pick(weighted)(n++), x: cx - 75, y: cy - 105, s, rot, blur, b, z: zBase + i });
  }
};
layer(34, 0.72, 0.92, 2.6, 0.78, 0);
layer(26, 0.95, 1.18, 1.1, 0.93, 100);
layer(13, 1.2, 1.48, 0, 1.03, 200, 0.92, 0.9);

const cardHtml = cards.map((c) =>
  `<div class="slot" style="left:${c.x.toFixed(1)}px;top:${c.y.toFixed(1)}px;z-index:${c.z};transform:rotate(${c.rot.toFixed(2)}deg) scale(${c.s.toFixed(3)});filter:${c.blur ? `blur(${c.blur}px) ` : ""}brightness(${c.b.toFixed(3)})">${c.html}</div>`,
).join("\n");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jersey+10&family=VT323&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { position: relative; background:
      radial-gradient(ellipse 70% 60% at 50% 38%, #7A5200 0%, transparent 70%),
      linear-gradient(180deg, #5A3C00 0%, #2A1A00 100%); }
  .slot { position: absolute; width: 150px; transform-origin: 50% 50%; }
  .card { width: 150px; aspect-ratio: 63 / 88; padding: 6px; display: flex;
    box-shadow: 0 0 0 3px #1A0800, 0 18px 36px rgba(0,0,0,.55), 0 0 24px rgba(255,190,40,.18); }
  .card.gold { background: linear-gradient(155deg, #FFF0A8 0%, #FFD740 22%, #FFCB05 48%, #F0A500 78%, #C47A00 100%); }
  .card.silver { background: linear-gradient(155deg, #FFFFFF 0%, #E6EAF5 40%, #B9C4E0 75%, #8D9BC2 100%); }
  .in { flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 6px; box-shadow: inset 0 0 0 2px #1A0800; overflow: hidden; }
  .in-gold { background: linear-gradient(180deg, #FFE9A8 0%, #FFD36B 55%, #F2B544 100%); }
  .in-head { background: linear-gradient(180deg, #FFE08A 0%, #F5BE45 100%); }
  .in-coin { background: linear-gradient(180deg, #FFE6A0 0%, #F0B23E 100%); }
  .in-spark { background: radial-gradient(circle at 50% 52%, #FFFFFF 0 8%, #FFF1C2 20%, #FFD740 46%, #F0A500 78%, #C47A00 100%); }
  .in-file { background: linear-gradient(180deg, #24180A 0%, #120B03 100%); }
  .in-violet { background: linear-gradient(180deg, #4E2A8A 0%, #2C1650 34%, #160A27 100%); }
  .in-navy { background: linear-gradient(180deg, #1C3272 0%, #0C1A3E 34%, #050A1C 100%); }
  .in-emerald { background: linear-gradient(180deg, #17613F 0%, #0B3322 34%, #04180F 100%); }
  .hd { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
  .hd b { font: 400 17px/1 "Jersey 10", monospace; color: #1A0800; white-space: nowrap; overflow: hidden; }
  .in-violet .hd b, .in-navy .hd b, .in-emerald .hd b { color: #FFFFFF; text-shadow: 1px 1px 0 #000; }
  .hd em { font: normal 11px/1 VT323, monospace; letter-spacing: 1px; padding: 1px 4px; color: #FFF8E7; background: #1A0800; }
  .hd.file span { font: 12px/1 VT323, monospace; color: #FFCB05; white-space: nowrap; overflow: hidden; }
  .hd.file em { color: #FFD740; background: rgba(255,203,5,.14); box-shadow: 0 0 0 1px rgba(255,203,5,.4); }
  .plq { font: 400 15px/1 "Jersey 10", monospace; color: #FFCB05; padding: 2px 4px; background: rgba(0,0,0,.45); box-shadow: 0 0 0 1px #FFCB05; }
  .art { position: relative; height: 104px; display: grid; place-items: center; overflow: hidden;
    box-shadow: inset 0 0 0 2px #1A0800, inset 0 0 0 4px #FFE680, inset 0 0 0 5px #C47A00; }
  .art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(118deg, transparent 30%, rgba(255,255,255,.28) 44%, rgba(255,240,180,.12) 52%, transparent 64%); }
  .art-gold { background: radial-gradient(circle at 50% 56%, #FFFFFF 0 10%, #FFF3C4 26%, #FFD36B 52%, #F0A500 100%); }
  .art-head { height: 112px; background: radial-gradient(circle at 50% 50%, #FFF8E7 0 14%, #FFE08A 38%, #F0A500 100%); }
  .art-coin { height: 112px; background: radial-gradient(circle at 50% 50%, #FFF8E7 0 10%, #FFD740 40%, #E08A00 100%); }
  .art-violet { height: 84px; background: radial-gradient(circle at 50% 55%, rgba(255,203,5,.35) 0 22%, transparent 52%), linear-gradient(180deg, #2C1650, #160A27); }
  .art-navy { height: 84px; background: radial-gradient(circle at 50% 55%, rgba(120,160,255,.35) 0 22%, transparent 52%), linear-gradient(180deg, #0C1A3E, #050A1C); }
  .art-emerald { height: 84px; background: radial-gradient(circle at 50% 55%, rgba(255,92,138,.35) 0 22%, transparent 52%), linear-gradient(180deg, #0B3322, #04180F); }
  .spark { flex: 1; display: grid; place-items: center; filter: drop-shadow(0 0 10px rgba(255,255,255,.7)); }
  .txt { display: flex; flex-direction: column; gap: 5px; padding: 4px 2px; }
  .ln { display: block; height: 4px; background: rgba(255,248,231,.38); }
  .ln-dark { background: rgba(122,66,0,.55); }
  .ln-light { background: rgba(233,221,255,.45); }
  .ttl { font: 400 18px/1 "Jersey 10", monospace; color: #FFF8E7; }
  .tags { display: flex; gap: 6px; } .tags i { width: 34px; height: 9px; background: rgba(255,248,231,.12); }
  .btns { margin-top: auto; display: flex; gap: 6px; } .btns i { height: 14px; width: 22px; box-shadow: 0 0 0 2px rgba(255,203,5,.5); background: rgba(255,203,5,.08); }
  .btns i.open { width: 16px; } .btns i.wide { flex: 1; background: #FFCB05; box-shadow: 0 0 0 2px #F0A500; }
  .rib { margin: -2px 6px 0; padding: 2px 4px; text-align: center; font: 11px/1 VT323, monospace; color: #1A0800;
    background: linear-gradient(90deg, #F0A500, #FFE680, #F0A500); box-shadow: 0 0 0 1px #1A0800; white-space: nowrap; overflow: hidden; }
  .in-navy .rib { background: linear-gradient(90deg, #C9D3EE, #FFFFFF, #C9D3EE); color: #0C1A3E; }
  .perks { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 6px; background: rgba(10,4,20,.55); }
  .ft { margin-top: auto; display: flex; justify-content: space-between; font: 11px/1 VT323, monospace; color: #7A4200; }
  .in-spark .ft { color: #7A4200; }
  /* light and lens: a warm glow in the middle, darker edges */
  .glow { position: absolute; inset: 0; z-index: 900; pointer-events: none;
    background: radial-gradient(ellipse 55% 50% at 50% 40%, rgba(255,214,90,.22) 0%, transparent 70%); mix-blend-mode: screen; }
  .vig { position: absolute; inset: 0; z-index: 901; pointer-events: none;
    background: radial-gradient(ellipse 80% 75% at 50% 45%, transparent 52%, rgba(26,12,0,.55) 100%); }
</style></head><body>
${cardHtml}
<div class="glow"></div><div class="vig"></div>
</body></html>`;

// ── Render ────────────────────────────────────────────────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), "pikamd-bg-"));
const page = join(work, "scene.html");
writeFileSync(page, html);
const port = 9400 + Math.floor(Math.random() * 80);
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
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: "file://" + page });
  await new Promise((r) => setTimeout(r, 2500));
  const fonts = await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(','))", awaitPromise: true, returnByValue: true });
  console.log("fonts loaded:", fonts.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const png = Buffer.from(shot.result.data, "base64");
  writeFileSync(outPng, png);
  if (outWebp) await sharp(png).webp({ quality: 82, effort: 6 }).toFile(outWebp);
  console.log("cards:", cards.length);
  ws.close();
} finally {
  // wait for Chrome to exit before removing its profile
  await new Promise((r) => { chrome.once("exit", r); chrome.kill("SIGKILL"); });
  try { rmSync(work, { recursive: true, force: true }); } catch { /* left in the temp dir */ }
}
