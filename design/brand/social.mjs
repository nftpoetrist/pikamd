// PikaMd's X images, drawn from the site's own pixel maps (no third-party logos):
//   design/brand/pikamd-x-profile.png  1000×1000, safe for X's circle crop
//   design/brand/pikamd-x-header.png   1500×500, the pika catching .md pages, coins and sparkles
//
//   node --experimental-strip-types design/brand/social.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../../web");
const { PIKA, PIKA_PALETTE } = await import(join(WEB, "components/brand/pika-art.ts"));
const coinSrc = readFileSync(join(WEB, "components/PikaGoldCoin.tsx"), "utf8");
const arrayIn = (text, name) => [...text.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
const colorsIn = (text, name) => Object.fromEntries([...text.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\};`))[1].matchAll(/(\w)\s*:\s*"(#[0-9A-Fa-f]{6})"/g)].map((x) => [x[1], x[2]]));
const COIN = arrayIn(coinSrc, "MAP"), COIN_COLORS = colorsIn(coinSrc, "COLORS");

// 4-point sparkle (same as the background's)
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

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Jersey+10&family=VT323&display=block" rel="stylesheet">`;
const BASE = `* { box-sizing: border-box; margin: 0; }
  body { position: relative; overflow: hidden; background: #0C0700; }
  .bg { position: absolute; inset: 0; background:
      repeating-linear-gradient(0deg, rgba(255,203,5,.035) 0 1px, transparent 1px 4px),
      radial-gradient(ellipse 60% 70% at var(--gx, 50%) var(--gy, 50%), rgba(90,60,0,.9) 0%, rgba(42,26,0,.85) 45%, #0C0700 100%); }
  .dust { position: absolute; width: 4px; height: 4px; background: #FFCB05; }`;

// Seeded dust pixels
let seed = 20261015;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const dust = (w, h, n) => Array.from({ length: n }, () => `<i class="dust" style="left:${Math.round(rnd() * w)}px;top:${Math.round(rnd() * h)}px;opacity:${(0.15 + rnd() * 0.45).toFixed(2)}"></i>`).join("");

const profile = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  html, body { width: 1000px; height: 1000px; }
  .pika { position: absolute; left: 180px; top: 180px; filter: drop-shadow(0 0 60px rgba(255,203,5,.45)); }
</style></head><body><div class="bg"></div>${dust(1000, 1000, 40)}
  <div class="pika">${svg(PIKA, PIKA_PALETTE, 20)}</div>
</body></html>`;

const page = (kind, rot) => `<div class="page" style="transform: rotate(${rot}deg)"><b>${kind}</b><i style="width:78%"></i><i style="width:92%"></i><i style="width:64%"></i><i style="width:84%"></i></div>`;
const speed = (n) => `<span class="speed">${Array.from({ length: n }, (_, i) => `<i style="width:${36 + ((i * 17) % 40)}px"></i>`).join("")}</span>`;
const header = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  html, body { width: 1500px; height: 500px; }
  body { --gx: 34%; --gy: 62%; }
  .pika { position: absolute; left: 330px; top: 150px; filter: drop-shadow(0 0 34px rgba(255,203,5,.55)); }
  .ghost { position: absolute; top: 150px; filter: grayscale(.2); }
  .word { position: absolute; right: 64px; top: 52px; text-align: right; }
  .word h1 { font: 400 92px/0.9 "Jersey 10", monospace; color: #FFF8E7; text-shadow: 4px 4px 0 rgba(0,0,0,.75); letter-spacing: 1px; }
  .word h1 span { color: #FFCB05; text-shadow: 4px 4px 0 #7A4200; }
  .word p { margin-top: 14px; font: 34px/1 VT323, monospace; color: #FFF8E7; text-shadow: 2px 2px 0 #000; }
  .word small { display: block; margin-top: 10px; font: 24px/1 VT323, monospace; color: #FFCB05; }
  .item { position: absolute; display: flex; align-items: center; gap: 14px; }
  .speed { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; order: 2; }
  .speed i { display: block; height: 5px; background: rgba(255,215,64,.28); }
  .page { width: 74px; height: 94px; padding: 9px 9px 0; background: #FFF8E7; box-shadow: 0 0 0 3px #1A0800, 0 0 0 7px #FFCB05, 0 0 0 10px #1A0800, 0 10px 24px rgba(0,0,0,.6), 0 0 30px rgba(255,203,5,.35);
    display: flex; flex-direction: column; gap: 7px; }
  .page b { align-self: flex-start; padding: 1px 5px; font: 15px/1 VT323, monospace; letter-spacing: 1px; color: #FFF8E7; background: #1A0800; }
  .page i { display: block; height: 5px; background: #B08A4A; }
  .floor { position: absolute; left: 80px; right: 40px; top: 460px; height: 4px; background: repeating-linear-gradient(90deg, rgba(255,203,5,.55) 0 14px, transparent 14px 26px); }
  .glow { filter: drop-shadow(0 0 16px rgba(255,203,5,.55)); }
</style></head><body><div class="bg"></div>${dust(1500, 500, 70)}
  <div class="ghost" style="left:250px;opacity:.10">${svg(PIKA, PIKA_PALETTE, 9)}</div>
  <div class="ghost" style="left:280px;opacity:.18">${svg(PIKA, PIKA_PALETTE, 9)}</div>
  <div class="ghost" style="left:305px;opacity:.28">${svg(PIKA, PIKA_PALETTE, 9)}</div>
  <div class="pika">${svg(PIKA, PIKA_PALETTE, 9)}</div>
  <div class="item" style="left:690px;top:300px">${page("RULES", -8)}${speed(3)}</div>
  <div class="item glow" style="left:860px;top:236px">${svg(COIN, COIN_COLORS, 5)}${speed(3)}</div>
  <div class="item" style="left:1010px;top:318px">${page("SKILL", 7)}${speed(3)}</div>
  <div class="item glow" style="left:1190px;top:262px">${svg(SPARK.rows, SPARK.palette, 4)}${speed(2)}</div>
  <div class="item" style="left:1330px;top:330px">${page("AGENT", -5)}</div>
  <div class="word"><h1>Pika<span>Md</span></h1><p>Catch the best AI guidelines</p><small>Markdown guidelines · MCP for any agent</small></div>
  <div class="floor"></div>
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
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    ws.close();
  } finally {
    await new Promise((r) => { chrome.once("exit", r); chrome.kill("SIGKILL"); });
    try { rmSync(work, { recursive: true, force: true }); } catch { /* left in the temp dir */ }
  }
}

await render(profile, 1000, 1000, join(HERE, "pikamd-x-profile.png"));
await render(header, 1500, 500, join(HERE, "pikamd-x-header.png"));
console.log("pikamd-x-profile.png, pikamd-x-header.png");
