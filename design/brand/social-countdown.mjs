// PikaMd X image "Countdown to mainnet" (2026-11-04). Same family as the other X images (the pixel
// cat from pika-art.ts, Jersey 10 + VT323, hard shadows, a faint grid, stars) in a new mood: an Arc
// blue night turning into a gold dawn. Three flip-clock tiles count down along a gold timeline:
// 3 "Live on testnet" and 2 "Pre-mainnet review" are done, 1 "Arc mainnet" stands in front of the
// rising sun. The running cat (the home plaque's trot, run-cat.ts) carries its .md page towards it;
// an hourglass is running out in the sky. No launch date is shown: there isn't one yet.
//   design/brand/pikamd-x-countdown.png  1600×900 (git-ignored: uploaded to X by hand)
//
//   node --experimental-strip-types design/brand/social-countdown.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../../web");
const ART = join(WEB, "components/brand/pika-art.ts");

// run-cat.ts imports the mascot through the app's "@/" alias: load a copy that points at the file
const work = mkdtempSync(join(tmpdir(), "pikamd-countdown-"));
const runCat = join(work, "run-cat.ts");
writeFileSync(runCat, readFileSync(join(WEB, "components/brand/run-cat.ts"), "utf8").replace("@/components/brand/pika-art", ART));
const { RUN_FRAMES, RUN_GOLD } = await import(runCat);

const W = 1600, H = 900;
const HORIZON = 600; // where the sky meets the ground
const TRACK = 706; // the gold timeline the tiles and the cat stand on

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

// ── The sun: a pixel half disc rising on the horizon, its lower half cut by widening gaps ─────
const SUN_R = 27, SUN_PX = 6; // 27 pixels × 6 px = a 162 px radius
const SUN = (() => {
  const rows = [];
  for (let y = 0; y < SUN_R; y++) {
    const dy = SUN_R - y - 0.5;
    let row = "";
    // gaps in the lower part, wider towards the horizon (the classic retro sun)
    const gap = y > 13 && (y - 14) % 4 >= 4 - Math.min(3, Math.floor((y - 14) / 4) + 1);
    for (let x = 0; x < SUN_R * 2; x++) {
      const dx = x - SUN_R + 0.5;
      const d = Math.hypot(dx, dy);
      if (d > SUN_R || gap) { row += "."; continue; }
      row += y < 7 ? "C" : y < 14 ? "L" : y < 20 ? "Y" : "G";
    }
    rows.push(row);
  }
  return rows;
})();
const SUN_COLORS = { C: "#FFF1C2", L: "#FFE680", Y: "#FFD740", G: "#FFCB05" };

// ── The hourglass: gold frame, pale glass, the last of the sand running down ─────────────────
const HOURGLASS = (() => {
  const w = 21, h = 33, c = 10;
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  for (let x = 0; x < w; x++) { g[0][x] = "O"; g[1][x] = "F"; g[2][x] = "D"; g[h - 3][x] = "F"; g[h - 2][x] = "D"; g[h - 1][x] = "O"; }
  g[1][0] = g[1][w - 1] = g[h - 2][0] = g[h - 2][w - 1] = "O";
  g[2][0] = g[2][w - 1] = g[h - 3][0] = g[h - 3][w - 1] = "O";
  // Glass half-width at each row between the plates: wide at the ends, 1 at the neck
  const inner = 3, last = h - 4, mid = (inner + last) / 2;
  const half = (y) => Math.max(1, Math.round(7.5 * (Math.abs(y - mid) / (mid - inner)) ** 0.9));
  for (let y = inner; y <= last; y++) {
    const hw = half(y);
    for (let x = c - hw; x <= c + hw; x++) g[y][x] = "g";
    g[y][c - hw - 1] = "O"; g[y][c + hw + 1] = "O";
    g[y][c - hw] = "h"; // glass shine on the left edge
  }
  // Sand: a little left in the top bulb, the stream, a pile in the bottom bulb
  for (let y = 11; y < mid; y++) for (let x = c - half(y) + 1; x <= c + half(y); x++) g[y][x] = "s";
  for (let y = Math.ceil(mid); y <= last; y++) g[y][c] = "s";
  for (let y = 21; y <= last; y++) {
    const hw = Math.min(half(y), y - 20);
    for (let x = c - hw + 1; x <= c + hw; x++) g[y][x] = y > 27 ? "S" : "s";
  }
  // The frame's two posts
  for (let y = 3; y <= last; y++) { g[y][1] = "P"; g[y][w - 2] = "P"; g[y][0] = "O"; g[y][w - 1] = "O"; }
  return g.map((r) => r.join(""));
})();
const HOURGLASS_COLORS = { O: "#1A0800", F: "#F0A500", D: "#7A4200", P: "#C47A00", g: "#25397A", h: "#6A86D8", s: "#FFCB05", S: "#F0A500" };

// A green check, as on the VERIFIED badge (ReviewedMark.tsx): 8×7
const CHECK = [
  ".......O",
  "......OO",
  "O....OO.",
  "OO..OO..",
  ".OOOO...",
  "..OO....",
  "........",
];

// ── Sky, stars, ground ───────────────────────────────────────────────────────────────────────
// Stepped bands, Arc blue at the top to PikaMd gold on the horizon
const BANDS = [
  [0, "#050A1C"], [140, "#0A1534"], [250, "#142658"], [340, "#1C3272"], [410, "#2E3A7A"],
  [466, "#4A3C78"], [510, "#7A4A6A"], [545, "#B0604A"], [570, "#E08A00"], [588, "#F0A500"],
];
const sky = BANDS.map(([y], i) => {
  const next = BANDS[i + 1]?.[0] ?? HORIZON;
  return `<i class="band" style="top:${y}px;height:${next - y}px;background:${BANDS[i][1]}"></i>`;
}).join("");

let seed = 20261104;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const clearOf = (x, y) => y < 400 && !(x < 940 && y > 40 && y < 390) && !(x > 1310 && x < 1500 && y > 50 && y < 310);
const stars = Array.from({ length: 64 }, () => {
  let x, y;
  do { x = Math.round(rnd() * W / 3) * 3; y = Math.round(rnd() * 400 / 3) * 3; } while (!clearOf(x, y));
  const gold = rnd() < 0.2, size = rnd() < 0.15 ? 6 : 3;
  const fade = Math.max(0.15, 1 - y / 440);
  return `<i class="star" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${gold ? "#FFCB05" : "#C9D6FF"};opacity:${((0.3 + rnd() * 0.5) * fade).toFixed(2)}"></i>`;
}).join("");

// The timeline's ticks: a ruler of time, a tall tick under every tile
const TILES = [
  { x: 250, n: "3", title: "Live on testnet", note: "since Oct 2026", done: true },
  { x: 640, n: "2", title: "Pre-mainnet review", note: "Nov 2026", done: true },
  { x: 1230, n: "1", title: "Arc mainnet", note: "on its way", done: false, big: true },
];
const tileW = (t) => (t.big ? 186 : 150), tileH = (t) => (t.big ? 226 : 186);
const ticks = Array.from({ length: Math.floor((W - 140) / 30) + 1 }, (_, i) => {
  const x = 70 + i * 30;
  const major = TILES.some((t) => Math.abs(t.x + tileW(t) / 2 - x) < 15);
  const lit = x < 1130; // the part of the timeline already behind the cat
  return `<i class="tick" style="left:${x - 1}px;top:${TRACK + 6}px;height:${major ? 18 : 9}px;background:${lit ? "#FFCB05" : "#6A86D8"}"></i>`;
}).join("");

// ── Flip-clock tiles ─────────────────────────────────────────────────────────────────────────
const tile = (t) => {
  const w = tileW(t), h = tileH(t), top = TRACK - h - 10;
  const check = t.done ? `<div class="check">${svg(CHECK, { O: "#0C2A16" }, 4)}</div>` : `<span class="next">NEXT</span>`;
  return `<div class="tile ${t.done ? "done" : "goal"}" style="left:${t.x}px;top:${top}px;width:${w}px;height:${h}px">
    <span class="digit" style="font-size:${t.big ? 250 : 206}px">${t.n}</span>
    <i class="split"></i><i class="hinge l"></i><i class="hinge r"></i>
    ${check}
  </div>
  <div class="label ${t.done ? "" : "goal"}" style="left:${t.x + w / 2 - 160}px;top:${TRACK + 34}px"><b>${t.title}</b><span>${t.note}</span></div>`;
};

// The cat: the plaque's trot frame with a planted paw and dust, 5×, mirrored to run right
const CAT_SCALE = 5;
const CAT = RUN_FRAMES[0];
const CAT_X = 950, CAT_TOP = TRACK - 34 * CAT_SCALE; // its paw outline row (34) sits on the timeline
const speed = [[0, 70, 92], [22, 104, 60], [10, 138, 76]].map(([dx, dy, w]) =>
  `<i class="speed" style="left:${CAT_X - w - 14 - dx}px;top:${CAT_TOP + dy}px;width:${w}px"></i>`).join("");

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Jersey+10&family=VT323&display=block" rel="stylesheet">`;
const frame = (c, b = 4) => `box-shadow: 0 -${b}px 0 ${c}, 0 ${b}px 0 ${c}, -${b}px 0 0 ${c}, ${b}px 0 0 ${c}`;
const SUN_X = TILES[2].x + tileW(TILES[2]) / 2 - SUN_R * SUN_PX;
const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; }
  body { position: relative; overflow: hidden; background: #050A1C; color: #FFF8E7; }
  .band, .star, .tick, .speed { position: absolute; }
  .band { left: 0; right: 0; }
  .grid { position: absolute; left: 0; right: 0; top: 0; height: ${HORIZON}px; background-image:
      linear-gradient(rgba(143,170,240,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(143,170,240,.045) 1px, transparent 1px);
    background-size: 40px 40px; }
  .scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(5,10,28,.10) 0 1px, transparent 1px 4px); pointer-events: none; }
  .glow { position: absolute; left: ${SUN_X - 260}px; top: ${HORIZON - 420}px; width: ${SUN_R * SUN_PX * 2 + 520}px; height: 520px;
    background: radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,215,64,.32) 0%, rgba(240,165,0,.12) 45%, transparent 72%); }
  .sun { position: absolute; left: ${SUN_X}px; top: ${HORIZON - SUN_R * SUN_PX}px; }
  .hourglass { position: absolute; left: 1350px; top: 72px; filter: drop-shadow(5px 5px 0 rgba(5,10,28,.7)) drop-shadow(0 0 26px rgba(255,203,5,.25)); }
  .hg-note { position: absolute; left: 1336px; top: 286px; width: 160px; text-align: center; font: 22px/1 VT323, monospace; letter-spacing: 3px; color: #8FAAF0; text-shadow: 2px 2px 0 #050A1C; }

  /* Ground: dark stepped bands, a sunlit strip on the horizon, the gold timeline */
  .ground { position: absolute; left: 0; right: 0; top: ${HORIZON}px; bottom: 0; background: linear-gradient(180deg,
      #7A4200 0 6px, #3A2410 6px 12px, #1A1430 12px 40px, #121230 40px 80px, #0C1A3E 80px 150px, #08112A 150px 100%); }
  .ground::before { content: ""; position: absolute; left: ${SUN_X - 40}px; width: ${SUN_R * SUN_PX * 2 + 80}px; top: 12px; height: 96px;
    background: repeating-linear-gradient(180deg, rgba(255,203,5,.22) 0 3px, transparent 3px 12px); -webkit-mask: linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent); }
  .track { position: absolute; left: 70px; right: 70px; top: ${TRACK}px; height: 6px;
    background: repeating-linear-gradient(90deg, #FFCB05 0 18px, transparent 18px 30px); box-shadow: 0 3px 0 #7A4200; }
  .track.ahead { left: 1130px; background: repeating-linear-gradient(90deg, #6A86D8 0 18px, transparent 18px 30px); box-shadow: 0 3px 0 #1C3272; }

  .tile { position: absolute; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #1C2A5E 0 50%, #142152 50% 100%);
    ${frame("#050A1C")}, inset 0 4px 0 #2E4183, inset 0 -4px 0 #0C1A3E, 8px 10px 0 4px rgba(5,10,28,.6); }
  .tile.done { opacity: .96; }
  .tile.goal { background: linear-gradient(180deg, #2A1A08 0 50%, #1F1306 50% 100%);
    ${frame("#FFCB05")}, inset 0 4px 0 #FFE680, inset 0 -4px 0 #7A4200, 8px 10px 0 4px rgba(5,10,28,.6), 0 0 60px 10px rgba(255,203,5,.35); }
  .digit { font-family: "Jersey 10", monospace; line-height: 1; margin-top: 8px; color: #8FAAF0; text-shadow: 6px 6px 0 #050A1C; }
  .goal .digit { color: #FFCB05; text-shadow: 6px 6px 0 #7A4200; }
  .split { position: absolute; left: 0; right: 0; top: calc(50% - 2px); height: 4px; background: #050A1C; }
  .goal .split { background: #1A0800; }
  .hinge { position: absolute; top: calc(50% - 8px); width: 8px; height: 16px; background: #4E66B8; box-shadow: 0 0 0 3px #050A1C; }
  .goal .hinge { background: #C47A00; box-shadow: 0 0 0 3px #1A0800; }
  .hinge.l { left: -4px; } .hinge.r { right: -4px; }
  .check { position: absolute; right: -16px; top: -16px; width: 48px; height: 44px; display: flex; align-items: center; justify-content: center;
    background: #3FBF7F; ${frame("#0C2A16", 3)}, inset 0 3px 0 #8FE0B4, inset 0 -3px 0 #23804F; }
  .check svg { margin: 4px 0 0 4px; }
  .next { position: absolute; left: 50%; top: -24px; transform: translateX(-50%); padding: 6px 14px 4px; font: 24px/1 VT323, monospace; letter-spacing: 3px;
    color: #1A0800; background: #FFCB05; ${frame("#1A0800", 3)}, inset 0 -3px 0 #C47A00; }
  .label { position: absolute; width: 320px; text-align: center; text-shadow: 2px 2px 0 #050A1C; }
  .label b { display: block; font: 400 34px/1 "Jersey 10", monospace; letter-spacing: 1px; color: #FFF8E7; }
  .label span { display: block; margin-top: 4px; font: 24px/1 VT323, monospace; letter-spacing: 2px; color: #8FAAF0; text-transform: uppercase; }
  .label.goal b { color: #FFCB05; text-shadow: 3px 3px 0 #7A4200; }
  .label.goal span { color: #FFD740; }

  .cat { position: absolute; left: ${CAT_X}px; top: ${CAT_TOP}px; transform: scaleX(-1); filter: drop-shadow(0 0 26px rgba(255,203,5,.4)); }
  .speed { height: 6px; background: #FFE680; opacity: .75; box-shadow: 6px 0 0 #050A1C00; }
  .speed::after { content: ""; position: absolute; left: -24px; top: 0; width: 12px; height: 6px; background: #FFE680; opacity: .5; }

  .head { position: absolute; left: 70px; top: 56px; }
  .tag { display: inline-block; padding: 7px 16px 5px; font: 24px/1 VT323, monospace; letter-spacing: 3px; color: #1A0800; background: #FFCB05;
    ${frame("#1A0800", 3)}, inset 0 -3px 0 #C47A00; }
  .head h1 { margin-top: 20px; font: 400 100px/0.88 "Jersey 10", monospace; letter-spacing: 1px; text-shadow: 5px 5px 0 #050A1C; }
  .head h1 span { color: #FFCB05; text-shadow: 5px 5px 0 #7A4200; }
  .head p { margin-top: 18px; font: 32px/1.15 VT323, monospace; color: #C9D6FF; text-shadow: 2px 2px 0 #050A1C; }

  .foot { position: absolute; left: 70px; right: 70px; bottom: 26px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline;
    font: 26px/1 VT323, monospace; color: #8FAAF0; letter-spacing: 1px; text-shadow: 2px 2px 0 #050A1C; }
  .foot b { font: 400 38px/1 "Jersey 10", monospace; color: #FFF8E7; letter-spacing: 1px; }
  .foot b span { color: #FFCB05; }
  .foot > :last-child { justify-self: end; }
</style></head><body>
  ${sky}<div class="grid"></div>${stars}
  <div class="glow"></div>
  <div class="sun">${svg(SUN, SUN_COLORS, SUN_PX)}</div>
  <div class="hourglass">${svg(HOURGLASS, HOURGLASS_COLORS, 6)}</div>
  <div class="hg-note">TICK · TOCK</div>

  <div class="ground"></div>
  <div class="track"></div><div class="track ahead"></div>${ticks}
  ${TILES.map(tile).join("")}
  ${speed}
  <div class="cat">${svg(CAT, RUN_GOLD, CAT_SCALE)}</div>

  <div class="head">
    <span class="tag">COUNTDOWN TO MAINNET</span>
    <h1>Next stop<br><span>Arc mainnet</span></h1>
    <p>PikaMd is live on Arc testnet today<br>The library is getting ready, one step at a time</p>
  </div>

  <div class="foot"><b>Pika<span>Md</span></b><span>Non-profit · fully public · built on Arc</span><span>pikamd.vercel.app</span></div>
  <div class="scan"></div>
</body></html>`;

async function render(html, width, height, out) {
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
  }
}

try {
  await render(html, W, H, join(HERE, "pikamd-x-countdown.png"));
  console.log("pikamd-x-countdown.png");
} finally {
  try { rmSync(work, { recursive: true, force: true }); } catch { /* left in the temp dir */ }
}
