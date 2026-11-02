// PikaMd X post image, "what PikaMd gives your agent" (2026-11-02), drawn from the site's own pixel
// maps (no third-party logos). Same family as social.mjs (pixel mascot, Jersey 10 + VT323, dust,
// grid, hard shadows) but a different mood: a night-blue Arc library instead of the warm gold room.
// The gold cat hands its .md page down a gold cable to an agent; four chips name what the agent gets.
//   design/brand/pikamd-x-post-agents.png  1600×900 (git-ignored: uploaded to X by hand)
//
//   node --experimental-strip-types design/brand/social-post.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../../web");
const { PIKA, PIKA_PALETTE } = await import(join(WEB, "components/brand/pika-art.ts"));
const { RULES, SKILLS, PROMPTS, AGENTS, ICON_PALETTE } = await import(join(HERE, "social-icons.mjs"));
const coinSrc = readFileSync(join(WEB, "components/PikaGoldCoin.tsx"), "utf8");
const glyphSrc = readFileSync(join(WEB, "components/PixelGlyph.tsx"), "utf8");
const arrayIn = (text, name) => [...text.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
const colorsIn = (text, name) => Object.fromEntries([...text.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\};`))[1].matchAll(/(\w)\s*:\s*"(#[0-9A-Fa-f]{6})"/g)].map((x) => [x[1], x[2]]));
const COIN = arrayIn(coinSrc, "MAP"), COIN_COLORS = colorsIn(coinSrc, "COLORS");
const glyphIn = (name) => [...glyphSrc.match(new RegExp(`\\b${name}: \\[([\\s\\S]*?)\\]`))[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);

// PixelGlyph's look as a letter map: lit top-left edge, shaded bottom-right edge, ink details, ink outline
const glyph = (name) => {
  const m = glyphIn(name), H = m.length, W = m[0].length;
  const at = (x, y) => m[y]?.[x] ?? ".";
  const face = (x, y) => at(x, y) === "#";
  const rows = [];
  for (let y = -1; y <= H; y++) {
    let row = "";
    for (let x = -1; x <= W; x++) {
      const c = at(x, y);
      if (c === "-") row += "O";
      else if (c === "#") row += !face(x, y - 1) || !face(x - 1, y) ? "L" : !face(x, y + 1) || !face(x + 1, y) ? "S" : "Y";
      else row += [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) !== ".") ? "O" : ".";
    }
    rows.push(row);
  }
  return rows;
};
const GLYPH_COLORS = { Y: "#FFCB05", L: "#FFE680", S: "#C47A00", O: "#1A0800" };

const SPARK = (() => {
  const N = 19, R = 8.2, c = 9;
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  const inside = (x, y) => (Math.abs(x - c) / R) ** (2 / 3) + (Math.abs(y - c) / R) ** (2 / 3) <= 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x, y)) {
    const d = Math.hypot(x - c, y - c);
    g[y][x] = d < 1.2 ? "W" : d < 2.6 ? "L" : x <= c && y <= c ? "Y" : "G";
  }
  return g.map((r) => r.join(""));
})();
const SPARK_GOLD = { W: "#FFFFFF", L: "#FFF1C2", Y: "#FFD740", G: "#F0A500" };
const SPARK_BLUE = { W: "#FFFFFF", L: "#EEF2FF", Y: "#C9D6FF", G: "#8FAAF0" };

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

// Seeded stars: mostly blue-white, a few gold
let seed = 20261102;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const clear = (x, y) => !(y > 40 && y < 280 && x > 200 && x < 1400) && y < 815 && !(y > 680 && y < 830);
const stars = (w, h, n) => Array.from({ length: n }, () => {
  const gold = rnd() < 0.22, size = rnd() < 0.15 ? 6 : 3;
  let x, y;
  do { x = Math.round(rnd() * w / 3) * 3; y = Math.round(rnd() * h / 3) * 3; } while (!clear(x, y));
  return `<i class="star" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${gold ? "#FFCB05" : "#C9D6FF"};opacity:${(0.18 + rnd() * 0.5).toFixed(2)}"></i>`;
}).join("");

// The gold cable from the cat's page to the agent, with white data pixels riding it
const cable = (() => {
  const W = 356, data = [30, 112, 200, 282];
  return `<div class="cable" style="width:${W}px">${data.map((x) => `<b style="left:${x}px"></b>`).join("")}</div>`;
})();

const chip = (icon, title, text) => `<div class="chip"><div class="chip-icon">${icon}</div><div><h3>${title}</h3><p>${text}</p></div></div>`;

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Jersey+10&family=VT323&display=block" rel="stylesheet">`;
const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1600px; height: 900px; }
  body { position: relative; overflow: hidden; background: #050A1C; color: #FFF8E7; }
  .bg { position: absolute; inset: 0; background:
      repeating-linear-gradient(0deg, rgba(143,170,240,.04) 0 1px, transparent 1px 4px),
      radial-gradient(ellipse 46% 52% at 50% 46%, rgba(255,203,5,.10) 0%, transparent 70%),
      radial-gradient(ellipse 75% 85% at 50% 40%, #1C3272 0%, #142658 38%, #0C1A3E 70%, #050A1C 100%); }
  .grid { position: absolute; inset: 0; background-image:
      linear-gradient(rgba(143,170,240,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(143,170,240,.05) 1px, transparent 1px);
    background-size: 40px 40px; }
  .star { position: absolute; }
  .spark { position: absolute; }

  .head { position: absolute; left: 0; right: 0; top: 54px; text-align: center; }
  .tag { display: inline-block; padding: 7px 16px 5px; font: 26px/1 VT323, monospace; letter-spacing: 3px; color: #1A0800; background: #FFCB05;
    box-shadow: 0 -3px 0 #1A0800, 0 3px 0 #1A0800, -3px 0 0 #1A0800, 3px 0 0 #1A0800, inset 0 -3px 0 #C47A00; }
  .head h1 { margin-top: 22px; font: 400 104px/0.9 "Jersey 10", monospace; letter-spacing: 1px; text-shadow: 5px 5px 0 #050A1C; }
  .head h1 span { color: #FFCB05; text-shadow: 5px 5px 0 #7A4200; }
  .head p { margin-top: 18px; font: 34px/1 VT323, monospace; color: #C9D6FF; text-shadow: 2px 2px 0 #050A1C; }
  .head p em { font-style: normal; color: #FFCB05; }

  .scene { position: absolute; left: 0; right: 0; top: 362px; height: 280px; }
  .shelf { position: absolute; left: 196px; top: 232px; width: 504px; height: 12px; background: #2E4183;
    box-shadow: 0 -3px 0 #050A1C, 0 3px 0 #050A1C, -3px 0 0 #050A1C, 3px 0 0 #050A1C, inset 0 3px 0 #6A86D8; }
  .cat { position: absolute; left: 462px; top: 4px; filter: drop-shadow(0 0 34px rgba(255,203,5,.5)); }
  .kind { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .label { position: absolute; top: 256px; text-align: center; font: 22px/1 VT323, monospace; color: #C9D6FF; text-shadow: 2px 2px 0 #050A1C; letter-spacing: 1px; }
  .cable { position: absolute; left: 726px; top: 118px; height: 6px; background: repeating-linear-gradient(90deg, #FFCB05 0 18px, #7A4200 18px 24px);
    box-shadow: 0 -3px 0 #050A1C, 0 3px 0 #050A1C; }
  .cable b { position: absolute; top: -3px; width: 12px; height: 12px; background: #FFFFFF; box-shadow: 0 0 12px rgba(255,255,255,.8); }
  .cable::after { content: ""; position: absolute; right: -6px; top: -9px; border-left: 18px solid #FFCB05; border-top: 12px solid transparent; border-bottom: 12px solid transparent; }
  .mcp { position: absolute; left: 878px; top: 72px; font: 26px/1 VT323, monospace; letter-spacing: 2px; color: #FFCB05; text-shadow: 2px 2px 0 #050A1C; }
  .agent { position: absolute; left: 1112px; top: 26px; filter: drop-shadow(0 0 36px rgba(143,170,240,.6)); }
  .term { position: absolute; left: 1060px; top: 222px; padding: 10px 16px 8px; background: #050A1C; font: 24px/1.15 VT323, monospace; color: #C9D6FF;
    box-shadow: 0 -3px 0 #4E66B8, 0 3px 0 #4E66B8, -3px 0 0 #4E66B8, 3px 0 0 #4E66B8; white-space: nowrap; }
  .term .ok { color: #3FBF7F; }
  .term .cur { display: inline-block; width: 10px; height: 18px; margin-left: 4px; background: #FFCB05; vertical-align: -2px; }

  .chips { position: absolute; left: 70px; right: 70px; top: 694px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
  .chip { display: flex; align-items: center; gap: 16px; padding: 18px 18px 16px; background: rgba(5,10,28,.82);
    box-shadow: 0 -3px 0 #4E66B8, 0 3px 0 #4E66B8, -3px 0 0 #4E66B8, 3px 0 0 #4E66B8, inset 0 3px 0 rgba(143,170,240,.18); }
  .chip-icon { flex: none; width: 66px; display: flex; justify-content: center; }
  .chip h3 { font: 400 32px/0.95 "Jersey 10", monospace; color: #FFCB05; text-shadow: 2px 2px 0 #7A4200; }
  .chip p { margin-top: 6px; font: 22px/1.05 VT323, monospace; color: #C9D6FF; }

  .foot { position: absolute; left: 70px; right: 70px; bottom: 26px; display: flex; justify-content: space-between; align-items: baseline;
    font: 24px/1 VT323, monospace; color: #6A86D8; letter-spacing: 1px; }
  .foot b { font: 400 34px/1 "Jersey 10", monospace; font-weight: 400; color: #FFF8E7; letter-spacing: 1px; }
  .foot b span { color: #FFCB05; }
  .floor { position: absolute; left: 70px; right: 70px; bottom: 70px; height: 4px; background: repeating-linear-gradient(90deg, rgba(106,134,216,.7) 0 14px, transparent 14px 26px); }
</style></head><body><div class="bg"></div><div class="grid"></div>${stars(1600, 900, 90)}
  <div class="spark" style="left:150px;top:120px">${svg(SPARK, SPARK_GOLD, 3)}</div>
  <div class="spark" style="left:1400px;top:90px">${svg(SPARK, SPARK_BLUE, 4)}</div>
  <div class="spark" style="left:1480px;top:520px">${svg(SPARK, SPARK_GOLD, 2)}</div>
  <div class="spark" style="left:96px;top:520px">${svg(SPARK, SPARK_BLUE, 2)}</div>

  <div class="head">
    <span class="tag">WHAT PIKAMD GIVES YOUR AGENT</span>
    <h1>A library your <span>agent can read</span></h1>
    <p>Save guidelines <em>·</em> connect once over MCP <em>·</em> just ask</p>
  </div>

  <div class="scene">
    <div class="kind" style="left:214px;top:162px">${svg(RULES, ICON_PALETTE, 3)}</div>
    <div class="kind" style="left:290px;top:165px">${svg(SKILLS, ICON_PALETTE, 3)}</div>
    <div class="kind" style="left:372px;top:171px">${svg(PROMPTS, ICON_PALETTE, 3)}</div>
    <small class="label" style="left:214px;width:54px">Rules</small>
    <small class="label" style="left:290px;width:63px">Skills</small>
    <small class="label" style="left:372px;width:69px">Prompts</small>
    <div class="cat">${svg(PIKA, PIKA_PALETTE, 7)}</div>
    <div class="shelf"></div>
    <span class="mcp">MCP</span>
    ${cable}
    <div class="agent">${svg(AGENTS, ICON_PALETTE, 9)}</div>
    <div class="term">&gt; my_collection <span class="ok">✓</span><span class="cur"></span></div>
  </div>

  <div class="chips">
    ${chip(svg(glyph("file"), GLYPH_COLORS, 5), "Your library", "Saved guidelines,<br>read over MCP")}
    ${chip(svg(glyph("plug"), GLYPH_COLORS, 5), "Your tools", "Claude Code, Cursor,<br>VS Code, Codex")}
    ${chip(svg(glyph("shield"), GLYPH_COLORS, 5), "Checked on Arc", "Every read matches<br>the hash on Arc")}
    ${chip(svg(COIN, COIN_COLORS, 4), "Fair to authors", "USDC tips, 100%<br>to the author")}
  </div>

  <div class="floor"></div>
  <div class="foot"><b>Pika<span>Md</span></b><span>Non-profit · fully public · live on Arc testnet</span><span>pikamd.vercel.app</span></div>
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

await render(html, 1600, 900, join(HERE, "pikamd-x-post-agents.png"));
console.log("pikamd-x-post-agents.png");
