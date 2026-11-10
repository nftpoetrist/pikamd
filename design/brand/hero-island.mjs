// The home title's floating grass island (user request 2026-11-10: "the background of 'Built by the
// community / for the community' exactly like this image, nothing more, nothing less"). The
// reference is the user's own mockup; every size, place and color below was measured from it, not
// guessed: the image shows the site's 1440px layout at ≈1.244×, and one art pixel here is 5 image
// pixels, drawn 4px wide on the site (2px on phones), so the island keeps the image's proportions.
// Colors are the image's own, sampled. Shapes with straight or curved edges (the book, its orbit,
// the island's underside) are rasterized from the corner points measured in the image; the cat,
// flowers, tufts, marks and stars are drawn by hand over the image's traced pixels.
//
//   node design/brand/hero-island.mjs   → writes web/components/brand/island-art.ts
//
// Coordinates in the comments: art pixels from the panel's outer top-left corner (the gold
// frame's top line), x to the right, y down; R = the panel's right edge.
import { writeFileSync } from "node:fs";

// ── Helpers ────────────────────────────────────────────────────────────────────────────────
const grid = (w, h, ch = ".") => Array.from({ length: h }, () => Array(w).fill(ch));
const toRows = (g) => g.map((r) => r.join(""));
const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Paints every cell whose centre is inside the polygon. */
const fillPoly = (g, pts, ch, only = null) => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++)
    if (inPoly(x + 0.5, y + 0.5, pts) && (only === null || only.includes(g[y][x]))) g[y][x] = ch;
};
/** A one-cell ring of `ch` around every cell in `body` (4-neighbourhood), on empty cells only. */
const outline = (g, body, ch, diagonal = false) => {
  const marks = [];
  const N = diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] !== ".") continue;
    if (N.some(([dx, dy]) => body.includes(g[y + dy]?.[x + dx]))) marks.push([x, y]);
  }
  for (const [x, y] of marks) g[y][x] = ch;
};
const stamp = (g, map, ox, oy) => map.forEach((row, y) => [...row].forEach((c, x) => { if (c !== "." && g[oy + y]?.[ox + x] !== undefined) g[oy + y][ox + x] = c; }));
const mirror = (half, center = "") => half.map((r) => r + center + [...r].reverse().join(""));
const check = (name, rows) => {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`${name}: row ${i} is ${r.length} wide, not ${w}`); });
  return rows;
};

// ── Palettes (sampled from the reference) ───────────────────────────────────────────────────
const GRASS = {
  a: "#fef745", // lit top edge
  b: "#abb12c",
  c: "#98a62b",
  d: "#85932b",
  e: "#69752a",
  f: "#5a662b", // drips
  g: "#4c552c", // drip tips
  k: "#2c2336", // shade under the band
};
const DIRT = {
  ...GRASS,
  T: "#482e44", // brick top light
  m: "#32243c", // dirt
  n: "#2a1f37",
  j: "#241c36", // brick joint
  L: "#13112b", // the dark underside
  O: "#07071a", // outline
  r: "#7d5546", // warm rim light on the outer silhouette
  S: "#241c37", // stalactite body
  s: "#4a394e", // stalactite edge light
  x: "#1e1830", // the deep lower mass
};
const CAT = {
  O: "#070506",
  o: "#fdab30",
  h: "#fdd46f",
  d: "#f78730",
  s: "#d66622",
  w: "#fceaca",
  v: "#e2bf9c",
  p: "#fad2ae",
  q: "#f6916f",
  n: "#2a1a12",
};
const MOUND = { K: "#1c1524", O: "#0a0710" };
const MARK = { h: "#faf0b0", Y: "#fad359", y: "#fbc519", q: "#e0a614" };
const BOOK = {
  O: "#09060c",
  W: "#fcf0cc",
  c: "#efcc99",
  t: "#d7b48a",
  K: "#241a22",
  k: "#342730",
  m: "#4f3736",
  b: "#68453b",
  h: "#fff0a0",
  Y: "#ffce3d",
  y: "#e8a92a",
};
const FLOWER = { W: "#faf8ec", w: "#e8e2c8", C: "#fbb52d", c: "#f39a1c", l: "#aab12b", g: "#6c8827", G: "#4f6d28", a: "#fef745" };
const GEM = { G: "#f5bb52", B: "#8a4f1a", D: "#261b26", E: "#32252e", h: "#fff0a8", Y: "#face4e", y: "#f4b835", s: "#c47a1f", W: "#fffbe6" };

// ── The cat peeking over the grass (38×29; head 34 wide, cheek tufts 2 each side) ──────────
// Left half (19 columns), mirrored. Ears r0–r4, head top line r4, closed happy eyes r14–r16,
// nose r17–r18, ω mouth r19–r21, white muzzle, paws r24–r28 resting on the grass surface.
const CAT_HALF = [
  "....OOO............",
  "...OhooO...........",
  "...OhwpoO..........",
  "..OhwppodO.........",
  "..OhwppqodO........",
  "..OowppqqodOOOOOOOO",
  "..Oowpqqoooddhhhhhh",
  "..Oowpqoooooohhhhhh",
  "..Oowqoooooooooohhh",
  "..Oowoooooooooooooo",
  ".Odoooooooooooooooo",
  ".Odoooooooooooooooo",
  "Odooooooooooooooooo",
  "Odooooooooooooooooo",
  "OdoooooooooOOOooooo",
  "OdooooooooOoooOoooo",
  "OdooooooooOoooOowww",
  "Odoooooooooooowwwnn",
  "Odooooooooooowwwwwn",
  "Odoooooooooowwwwwwn",
  ".Odooooooowwnwwwnnw",
  ".Odooooooowwwnnnwww",
  ".Osdoooooowwwwwwwww",
  "..Osddooovvwwwwwwww",
  "...OOOOOOOOdvvvvvvv",
  "..OwwwwwwwwOOpppppp",
  "..OwwwwwwwwwOvppppp",
  "..OwwnwwnwwwO.OOOOO",
  "..OOOOOOOOOOO......",
];
const CAT_MAP = check("cat", mirror(CAT_HALF));

// A dark mound behind the cat's left side (the image's dark shape beside the paw)
const MOUND_MAP = check("mound", [
  "....OOOO..",
  "..OOKKKKO.",
  ".OKKKKKKKO",
  "OKKKKKKKKK",
  "OKKKKKKKKK",
  "OKKKKKKKKK",
  "OKKKKKKKKK",
  "OKKKKKKKKK",
]);

// ── Two yellow marks beside the cat's head ("!" of surprise), 13×11 ─────────────────────────
const MARK_MAP = check("mark", [
  "...YYYY......",
  "...YYYY......",
  "..YYYYY......",
  "..YYYYY......",
  "..YYYY....yyy",
  ".YYYYY...yyyy",
  ".YYYY...yyyyy",
  "YYYYY..yyyyy.",
  "YYYY..yyyyy..",
  "......yyyy...",
  ".......yy....",
]);

// ── Daisy with two leaves (15×9): white plus-shaped head, orange heart, a stem into the grass ──
const FLOWER_MAP = check("flower", [
  "......WWW......",
  ".....WWWWW.....",
  "....WWCCCWW....",
  "....WWCCcWw....",
  "....wWWcWWw....",
  ".....wWWWw.....",
  ".a.....g.....a.",
  "..ll...g...ll..",
  "...lgg.g.ggl...",
]);

// Small grass tufts on the top surface (7×4)
const TUFT_MAP = check("tuft", [
  ".a...a.",
  ".b..ab.",
  "bc.bc.b",
  "cdccdcd",
]);

// ── Octagonal gold badge with a four-point star, on each side line (13×13) ───────────────────
const GEM_MAP = check("gem", [
  "....GGGGG....",
  "..GGBBBBBGG..",
  ".GBBDDhDDBBG.",
  ".GBDDDhDDDBG.",
  "GBDDDhhYDDDBG",
  "GBDDhhhYYDDBG",
  "GBhhhhWYYYyBG",
  "GBDDYYYyyDDBG",
  "GBDDDYyyDDDBG",
  ".GBDDDyDDDBG.",
  ".GBBDDsDDBBG.",
  "..GGBBBBBGG..",
  "....GGGGG....",
]);

// Four-point stars of the divider (drawn 3px per pixel): the centre one and the two small ones
const STAR_MAP = check("star", [
  "...h...",
  "...h...",
  "..hhY..",
  "hhhWYYy",
  "..YYy..",
  "...y...",
  "...y...",
]);
const STAR_SMALL_MAP = check("star small", [".Y.", "YhY", ".y."]);

// ── Open book (31×22), tilted: left page with five lines of text, right page dark with a star,
// loose page edges fanning over it, the dark cover all round, a bookmark at the spine ────────
function book() {
  const g = grid(33, 24);
  const at = (pts) => pts.map(([x, y]) => [x + 1, y + 1]); // one cell of room for the outline
  // cover (dark), then the pages over it
  fillPoly(g, at([[1.2, 13.4], [5.8, 0.6], [15.6, 3.2], [29.6, 5.0], [30.8, 6.8], [28.4, 19.8], [13.2, 21.4], [1.6, 17.6]]), "k");
  fillPoly(g, at([[1.6, 16.2], [13.2, 20.2], [28.0, 18.6], [28.4, 19.8], [13.2, 21.4], [1.6, 17.6]]), "K"); // cover edge, underside
  fillPoly(g, at([[2.6, 14.0], [6.4, 1.4], [15.4, 4.2], [12.2, 17.3]]), "W"); // left page
  fillPoly(g, at([[15.6, 4.4], [28.2, 6.2], [26.4, 17.8], [12.4, 17.4]]), "b"); // right page (dark)
  fillPoly(g, at([[16.0, 2.6], [22.4, 1.0], [28.6, 2.0], [29.0, 4.6], [28.4, 6.0], [15.8, 4.4]]), "W"); // fanned page edges
  fillPoly(g, at([[16.2, 3.6], [22.4, 2.4], [28.8, 3.4], [28.6, 4.4], [16.0, 4.4]]), "c");
  fillPoly(g, at([[3.0, 13.2], [5.0, 6.0], [7.0, 6.8], [4.8, 14.4]]), "c"); // shade along the left page's edge
  fillPoly(g, at([[12.6, 16.4], [15.0, 5.0], [15.6, 5.2], [13.2, 17.4]]), "c"); // shade in the fold
  fillPoly(g, at([[15.8, 5.4], [27.6, 7.0], [27.2, 8.2], [15.6, 6.6]]), "m"); // right page top shade
  fillPoly(g, at([[13.2, 17.8], [26.4, 17.9], [26.2, 18.6], [13.2, 18.6]]), "m");
  // five lines of text, sloping with the page
  for (const [x0, y0, len] of [[7.2, 4.3, 5], [6.8, 5.9, 6], [6.4, 7.6, 5], [6.0, 9.4, 6], [5.6, 11.2, 4]]) {
    for (let i = 0; i < len; i++) { const x = Math.floor(x0 + i) + 1, y = Math.floor(y0 + i * 0.3) + 1; if (g[y][x] === "W") g[y][x] = "t"; }
  }
  // the star on the dark page
  stamp(g, ["...Y...", "..YYY..", "YYYhYYY", ".YYYYy.", ".YYyYy.", "Yy...yy"], 18, 9);
  // bookmark tab under the spine
  stamp(g, ["mm", "KK"], 12, 21);
  outline(g, ["k", "K", "W", "c", "t", "b", "m", "Y", "y", "h"], "O", true);
  return toRows(g);
}
const BOOK_MAP = check("book", book());

// The orbit around the book, drawn on a 2px grid (half an art pixel) so the line stays thin.
// Measured: the ellipse's box is x 1117–1403, y 145–245 in the image, tilted up to the right.
function orbit() {
  const W = 118, H = 44; // half-art cells
  const back = grid(W, H), front = grid(W, H);
  const cx = W / 2, cy = H / 2, rx = 56.5, ry = 17.5, tilt = (-9 * Math.PI) / 180;
  for (let t = 0; t < 2 * Math.PI; t += 0.002) {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    const x = Math.floor(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)), y = Math.floor(cy + ex * Math.sin(tilt) + ey * Math.cos(tilt));
    (Math.sin(t) < 0 ? back : front)[y][x] = "R";
  }
  // a sparkle where the ring passes on the right
  stamp(front, ["..h..", ".hRh.", "hRWRh", ".hRh.", "..h.."], 104, 15);
  return { back: toRows(back), front: toRows(front) };
}
const ORBIT = orbit();
const RING = { R: "#e6b14d", h: "#fff0a0", W: "#ffffff" };

// ── Top grass: the high band (left end, repeating middle), the step down near the right end,
// the lower band (repeating middle, right end). 9 rows from the high surface (y −10) down. ──
const GRASS_HI_LEFT = check("grass hi left", [
  "..aaaa",
  ".abbbb",
  "abbbbb",
  "abbccc",
  "acccdd",
  ".eeeee",
  "..ff..",
  "......",
  "......",
]);
const GRASS_HI_TILE = check("grass hi tile", [
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bbbbcbbbbbbbbbbbbbcbbbbbbbbbbbbb",
  "bbccccbbbbbcbbbbcccccbbbbbbcbbbb",
  "cccdddccccccdcccccddddcccccdcccc",
  "eeeeeedddeeeeeeeeeeeedddeeeeeeee",
  ".fff........ffff.........ff.....",
  "..ff.........ff..........f......",
  "..g...........g.................",
]);
// The step: the high band rounds off and the lower band (4 rows lower) starts under it
const GRASS_STEP = check("grass step", [
  "aaaa.....",
  "bbbba....",
  "bbbbba...",
  "cbbbbba..",
  "dcccbbaaa",
  "eddccbbbb",
  ".fedcbbbb",
  "..feccccc",
  "...fddddd",
  "....eeeee",
  ".....f.ff",
  ".....f.f.",
  ".........",
]);
const GRASS_LO_TILE = check("grass lo tile", [
  "aaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbb",
  "bbbcbbbbbbbbbbbcbbbb",
  "bccccbbbbbcbbccccbbb",
  "ccdddcccccdcccdddccc",
  "eeeeeddeeeeeeeeeddee",
  "..fff.........ff....",
  "...f..........f.....",
  "...g................",
]);
const GRASS_LO_RIGHT = check("grass lo right", [
  "aaa...",
  "bbba..",
  "bbbba.",
  "cbbba.",
  "dccbba",
  "eedcca",
  "f.eddc",
  "f..eed",
  "....f.",
]);

// ── Underside: a thin grass strip under the frame, a band of dirt bricks, and under it a dark,
// lumpy mass with stalactites; the ends rise a little, step down diagonally and carry the tufts.
// Built column by column from profiles measured in the image (y = panel rows; the frame's bottom
// line is y 63, the grass strip y 64). Left end x −11…30, repeating middle 44 wide, right end
// R−40…R+10. ─────────────────────────────────────────────────────────────────────────────────
const UNDER_TOP = 50; // sprites start here (the tufts), down to y 90

/** Paints one column: top = first grass row, bottom = last row of the mass, drip = green rows
 * hanging into the dirt, joint = a brick joint in the dirt band. */
function underColumn(g, x, { top, bottom, drip = 0, joint = false, lit = false }) {
  const set = (y, c) => { if (g[y - UNDER_TOP] && x >= 0 && x < g[0].length) g[y - UNDER_TOP][x] = c; };
  set(top, lit ? "a" : "b");
  set(top + 1, "d");
  for (let y = top + 2; y <= Math.min(bottom, 74); y++) {
    const inDrip = y < top + 2 + drip;
    set(y, inDrip ? (y === top + 1 + drip ? "f" : "e") : joint ? "j" : y === top + 2 + drip ? "T" : y >= 73 ? "n" : "m");
  }
  for (let y = 75; y <= bottom; y++) set(y, y === bottom ? "j" : y <= 77 ? "n" : y <= 82 ? "x" : "S");
}
/** Outline, stalactite edge light and (on the ends) the warm rim, after all columns are painted. */
function underFinish(g, rim) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++)
    if (g[y][x] === "S" && (g[y][x - 1] === "." || g[y][x + 1] === "." || g[y][x - 1] === undefined || g[y][x + 1] === undefined)) g[y][x] = "s";
  const solid = ["m", "n", "L", "S", "s", "T", "j"];
  const marks = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] !== ".") continue;
    const below = y + UNDER_TOP > 64; // the grass on top keeps no outline
    if (below && [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => solid.includes(g[y + dy]?.[x + dx]))) marks.push([x, y]);
  }
  for (const [x, y] of marks) g[y][x] = "O";
  if (rim) {
    const rims = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++)
      if (g[y][x] === "." && y + UNDER_TOP > 64 && rim(x) && [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === "O")) rims.push([x, y]);
    for (const [x, y] of rims) g[y][x] = "r";
  }
}
const range = (a, b, v) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, v]);
const profile = (pairs) => Object.fromEntries(pairs.flat());

// Left end, panel x −11…30 (cell 0 = x −11)
function underLeft() {
  const g = grid(42, 95 - UNDER_TOP + 1);
  const top = profile([range(-10, -7, 61), range(-6, -2, 62), range(-1, 3, 63), range(4, 30, 64)]);
  const bottom = profile([
    [[-10, 67]], [[-9, 69]], [[-8, 70]], [[-7, 71]], range(-6, -5, 72), range(-4, -3, 73), range(-2, 0, 74),
    range(1, 3, 77), range(4, 7, 80), [[8, 82]], [[9, 84]], [[10, 86]], range(11, 13, 89), [[14, 87]],
    range(15, 17, 83), range(18, 21, 82), [[22, 84]], [[23, 87]], range(24, 26, 90), [[27, 87]], range(28, 30, 83),
  ]);
  for (let x = -10; x <= 30; x++) underColumn(g, x + 11, { top: top[x], bottom: bottom[x], lit: x <= -6, joint: x === 9 || x === 27, drip: x >= 18 && x <= 20 ? 2 : 0 });
  underFinish(g, (cx) => cx - 11 <= 10);
  stamp(g, UNDER_TUFT_L, 2, 53 - UNDER_TOP);
  return toRows(g);
}
// Repeating middle, 44 wide (cell 0 = the middle's first column)
function underTile() {
  const g = grid(44, 95 - UNDER_TOP + 1);
  const bottom = profile([range(0, 5, 82), range(6, 13, 83), range(14, 17, 84), range(18, 27, 82), range(28, 35, 83), range(36, 38, 84), range(39, 43, 82)]);
  for (let x = 0; x < 44; x++) underColumn(g, x, { top: 64, bottom: bottom[x], joint: x === 6 || x === 28, drip: (x >= 15 && x <= 17) ? 2 : x === 37 || x === 38 ? 1 : 0 });
  underFinish(g, null);
  return toRows(g);
}
// Right end, panel x R−40…R+10 (cell 0 = R−40)
function underRight() {
  const g = grid(51, 95 - UNDER_TOP + 1);
  const top = profile([range(-40, -7, 64), range(-6, -2, 63), range(-1, 3, 62), range(4, 10, 61)]);
  const bottom = profile([
    range(-40, -30, 82), range(-29, -26, 83), range(-25, -23, 85), [[-22, 89]], [[-21, 92]], range(-20, -18, 93), [[-17, 92]], [[-16, 88]],
    range(-15, -13, 83), range(-12, -9, 82), range(-8, -6, 80), range(-5, -3, 78), range(-2, 0, 75), range(1, 3, 72), range(4, 6, 70), range(7, 9, 68), [[10, 66]],
  ]);
  for (let x = -40; x <= 10; x++) underColumn(g, x + 40, { top: top[x], bottom: bottom[x], lit: x >= 5, joint: x === -33 || x === -10, drip: x >= -6 && x <= -4 ? 3 : 0 });
  underFinish(g, (cx) => cx - 40 >= -12);
  stamp(g, UNDER_TUFT_R, 36, 53 - UNDER_TOP);
  return toRows(g);
}
const UNDER_TUFT_L = [
  "........a...",
  ".a......a..a",
  ".ab..a..b.ab",
  "..b..ab.b.b.",
  "..bc.bb.bcb.",
  "a.cc.bc.cc..",
  "bbcdbccbcd..",
  "bccdccdcdd..",
];
const UNDER_TUFT_R = [
  "........a....",
  ".a.....ab....",
  ".b..a..b...a.",
  ".b..b..b..ab.",
  ".bc.b.bc..b..",
  ".cc.bcc..bc..",
  "bccdccdbccd..",
  "ccddcddcddd..",
];
const UNDER_LEFT = check("under left", underLeft());
const UNDER_TILE = check("under tile", underTile());
const UNDER_RIGHT = check("under right", underRight());

// ── The gold frame's top corners (its top line hides under the grass). Left: the line rounds off
// the side and climbs to the grass's left end (x 9, y −5…0); right: it runs out from under the
// lower grass and rounds down the side. Rows from y −5 (left) and y 0 (right). ────────────────
const FRAME = { G: "#f1b34e", g: "#d8962f" };
const FRAME_TL = check("frame tl", [
  ".........G",
  ".........G",
  ".........G",
  ".........G",
  ".........G",
  "...GGGGGGG",
  "..Gg......",
  ".Gg.......",
  ".G........",
  "G.........",
]);
const FRAME_TR = check("frame tr", [
  "GGGGGG...",
  "......G..",
  "......gG.",
  ".......G.",
  "........G",
]);

// Stalactites under the middle (measured: centre −15 down to y 87, centre +41 down to y 83)
const DROP_BIG = check("drop big", [
  "sSSSSs",
  "sSSSSs",
  "sSSSSs",
  ".sSSs.",
  ".sSSs.",
  ".sSSs.",
  "..ss..",
  "..OO..",
]);
const DROP_SMALL = check("drop small", [
  "sSSs",
  "sSSs",
  ".ss.",
  ".OO.",
]);

// A small round hole in the underside, near the middle (x centre + 49, y 77)
const HOLE_MAP = check("hole", [".OO.", "OsLO", "OLLO", ".OO."]);

// ── Explore: the cloud version (user requests 2026-11-10: "the same without the cat, thinner, a
// soft sky white like clouds", then "the frame must be a cloud, not a straight line; a pure white
// background, a soft cloud white where the text reads well"). The whole plaque is one cloud: a
// white body with puffs on every edge, big puffs on the corners, lit from the top left, a soft
// periwinkle outline. Built from unions of ellipses (in art pixels) so any width tiles cleanly.
const CLOUD = {
  W: "#ffffff", // lit edge
  w: "#f6f9ff", // body (also the panel inside, globals.css)
  m: "#e3e9f7", // shade
  s: "#cbd4ee", // deep shade, the underside
  o: "#a9b6dc", // outline
};

/**
 * A piece of the cloud: cells inside any ellipse [cx, cy, rx, ry] or body rect [x0, y0, x1, y1]
 * (end-exclusive). `period` wraps the ellipses (repeating tiles); `inner` lists the sides where the
 * piece continues into the cloud (no outline or lit edge there).
 */
function cloudPiece(w, h, { ellipses = [], rects = [], periodX = 0, periodY = 0, inner = [] }) {
  const inside = (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (rects.some(([x0, y0, x1, y1]) => px >= x0 && px < x1 && py >= y0 && py < y1)) return true;
    for (const [cx, cy, rx, ry] of ellipses)
      for (const sx of periodX ? [-periodX, 0, periodX] : [0])
        for (const sy of periodY ? [-periodY, 0, periodY] : [0])
          if (((px - cx - sx) / rx) ** 2 + ((py - cy - sy) / ry) ** 2 < 1) return true;
    return false;
  };
  const filled = (x, y) => {
    if (x < 0 || x >= w) { if (periodX) x = (x + w) % w; else return inner.includes(x < 0 ? "left" : "right"); }
    if (y < 0 || y >= h) { if (periodY) y = (y + h) % h; else return inner.includes(y < 0 ? "top" : "bottom"); }
    return inside(x, y);
  };
  const g = grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (inside(x, y)) {
      const up = filled(x, y - 1), left = filled(x - 1, y), down = filled(x, y + 1), right = filled(x + 1, y);
      g[y][x] = !up || !left ? "W" : !down ? "s" : !filled(x, y + 2) || !right ? "m" : "w";
    } else if (filled(x, y - 1) || filled(x - 1, y) || filled(x, y + 1) || filled(x + 1, y)) {
      g[y][x] = "o";
    }
  }
  return toRows(g);
}

// Top edge: puffs rising 10 art pixels over the panel (rows y −11…0); the bottom row is body
const CLOUD_TOP_TILE = check("cloud top", cloudPiece(48, 12, {
  ellipses: [[4, 9, 4.5, 5], [12.5, 8, 6, 7.5], [21.5, 9.5, 4.5, 5], [31, 7.5, 7, 8], [42, 9, 5, 5.5]],
  rects: [[0, 10, 48, 12]], periodX: 48, inner: ["bottom"],
}));
// Bottom edge: puffs hanging 8 art pixels under the panel (rows y H−1…H+7)
const CLOUD_BOTTOM_TILE = check("cloud bottom", cloudPiece(52, 9, {
  ellipses: [[7, 2, 6.5, 5.5], [20.5, 2, 4.5, 4], [33, 2, 7, 6], [46, 2, 5, 4.5]],
  rects: [[0, 0, 52, 2]], periodX: 52, inner: ["top"],
}));
// Sides: puffs bulging 6 art pixels out of the panel, repeating every 30 rows
const CLOUD_LEFT_TILE = check("cloud left", cloudPiece(8, 30, {
  ellipses: [[6.5, 4.5, 6.5, 4.5], [7, 15.5, 5.5, 5], [6.5, 25.5, 6, 4]],
  rects: [[6, 0, 8, 30]], periodY: 30, inner: ["right"],
}));
const CLOUD_RIGHT_TILE = check("cloud right", cloudPiece(8, 30, {
  ellipses: [[1.5, 9.5, 6.5, 4.5], [1, 20.5, 5.5, 5], [1.5, 0.5, 6, 4]],
  rects: [[0, 0, 2, 30]], periodY: 30, inner: ["left"],
}));
// Corners: one big puff each, over where the edges meet (18×18, the panel's corner at cell 8,10)
const CLOUD_CORNER_TL = check("cloud corner tl", cloudPiece(18, 18, {
  ellipses: [[8, 9, 7.5, 8], [3.5, 13, 3.5, 4], [14, 6, 4.5, 5]],
  rects: [[8, 10, 18, 18]], inner: ["right", "bottom"],
}));
const CLOUD_CORNER_TR = check("cloud corner tr", cloudPiece(18, 18, {
  ellipses: [[10, 9, 7.5, 8], [14.5, 13, 3.5, 4], [4, 6, 4.5, 5]],
  rects: [[0, 10, 10, 18]], inner: ["left", "bottom"],
}));
const CLOUD_CORNER_BL = check("cloud corner bl", cloudPiece(18, 16, {
  ellipses: [[8, 7, 7.5, 7], [3.5, 3, 3.5, 4], [14, 10, 4.5, 4.5]],
  rects: [[8, 0, 18, 7]], inner: ["right", "top"],
}));
const CLOUD_CORNER_BR = check("cloud corner br", cloudPiece(18, 16, {
  ellipses: [[10, 7, 7.5, 7], [14.5, 3, 3.5, 4], [4, 10, 4.5, 4.5]],
  rects: [[0, 0, 10, 7]], inner: ["left", "top"],
}));
// Badges and divider stars on the cloud: periwinkle rings, gold stars (the site's gold)
const CLOUD_GEM = { G: "#a9b6dc", B: "#cbd4ee", D: "#f6f9ff", E: "#eef2fb", h: "#fff3b0", Y: "#ffcb05", y: "#f0a500", s: "#c47a00", W: "#ffffff" };

// ── My Collection: a library shelf (user request 2026-11-10: "a library, in tune with the site,
// not crude: aesthetic, beautiful, premium"). Books stand on the shelf in two small clusters at
// the ends, their spines in the home cards' theme colours with gold bands; gold brackets under
// the shelf plank, gold corner caps, an open-book glyph on the divider. ─────────────────────
const SPINES = {
  violet: ["#a48be6", "#7a5cc4", "#4f3790"],
  navy: ["#6f8fdc", "#3a5aa8", "#22386f"],
  emerald: ["#6fd6a8", "#2fa478", "#1c6b4d"],
  ruby: ["#e3707f", "#c44458", "#84243a"],
  gold: ["#ffe680", "#f0a500", "#a86400"],
  cream: ["#fff3d6", "#e9d9b4", "#b9a57c"],
};
const BOOK_INK = "#120a04";
/** A cluster of books standing on the bottom row. Each book: [width, height, colour, label?];
 * "lean" books tilt (right or left) against their neighbour; "flat" lie in a stack. */
function shelfBooks(spec) {
  const H = Math.max(...spec.map((b) => (b.flat ? b.h * b.n : b.h))) + 2;
  const W = spec.reduce((sum, b) => sum + (b.flat ? b.w : b.lean ? b.h * 0.28 + b.w : b.w) + 1, 1);
  const w = Math.ceil(W) + 2;
  const g = grid(w, H);
  const palette = { O: BOOK_INK, g: "#ffcb05", L: "#fff3d6" };
  let key = 0;
  const colour = (name) => {
    const [l, b, d] = SPINES[name];
    const keys = ["abc", "def", "hij", "klm", "npq", "rst", "uvx", "yzA", "BCD", "EFH", "IJK"][key++];
    palette[keys[0]] = l; palette[keys[1]] = b; palette[keys[2]] = d;
    return keys;
  };
  let x = 1;
  for (const b of spec) {
    const [lit, base, dark] = colour(b.colour);
    if (b.flat) {
      // a stack of b.n books lying down, each b.h rows thick
      for (let i = 0; i < b.n; i++) {
        const y1 = H - 1 - i * b.h, y0 = y1 - b.h + 1, inset = i % 2;
        for (let y = y0; y <= y1; y++) for (let c = x + inset; c < x + b.w - (1 - inset); c++) g[y][c] = y === y0 ? lit : y === y1 ? dark : c === x + inset + 2 ? "g" : base;
      }
      x += b.w + 1;
      continue;
    }
    if (b.lean) {
      // a book leaning at ~25°: a parallelogram from its foot to its top
      const lean = b.lean === "right" ? 1 : -1, top = H - b.h, dx = b.h * 0.28;
      const x0 = lean > 0 ? x : x + dx;
      const pts = lean > 0
        ? [[x0, H], [x0 + b.w, H], [x0 + b.w + dx, top], [x0 + dx, top]]
        : [[x0, H], [x0 + b.w, H], [x0 + b.w - dx, top], [x0 - dx, top]];
      fillPoly(g, pts, base);
      for (let y = 0; y < H; y++) for (let c = 0; c < w; c++) if (g[y][c] === base && (g[y][c - 1] === "." || g[y][c - 1] === undefined)) g[y][c] = lit;
      const band = top + 2;
      for (let c = 0; c < w; c++) if ([base, lit].includes(g[band]?.[c])) g[band][c] = "g";
      x += Math.ceil(b.w + dx) + 1;
      continue;
    }
    const top = H - b.h;
    for (let y = top; y < H; y++) for (let c = x; c < x + b.w; c++) {
      const band = y === top + 2 || y === H - 3;
      g[y][c] = band ? "g" : c === x ? lit : c === x + b.w - 1 ? dark : base;
    }
    if (b.label) for (let y = top + 5; y < top + 7 && y < H - 4; y++) for (let c = x + 1; c < x + b.w - 1; c++) g[y][c] = "L";
    x += b.w + 1;
  }
  outline(g, Object.keys(palette).filter((k) => k !== "O"), "O");
  return { rows: toRows(g), palette };
}
const BOOKS_LEFT = shelfBooks([
  { w: 3, h: 11, colour: "violet" },
  { w: 4, h: 13, colour: "navy", label: true },
  { w: 3, h: 10, colour: "emerald" },
  { w: 3, h: 12, colour: "ruby" },
  { w: 4, h: 9, colour: "gold", label: true },
  { w: 4, h: 11, colour: "cream", lean: "right" },
]);
const BOOKS_RIGHT = shelfBooks([
  { w: 4, h: 11, colour: "navy", lean: "left" },
  { w: 3, h: 12, colour: "emerald" },
  { w: 4, h: 10, colour: "ruby", label: true },
  { w: 3, h: 13, colour: "violet" },
  { w: 3, h: 11, colour: "gold" },
  { w: 12, h: 2, n: 2, colour: "cream", flat: true },
]);
const WOOD = { G: "#f0a500", h: "#ffe680", s: "#a86400" };
const BRACKET = check("bracket", ["hGGGGs", ".GGGs.", "..GGs.", "...Gs.", "....s."]);
const CORNER_CAP = check("corner cap", ["hGGs", "G...", "G...", "s..."]);
const BOOK_GLYPH = check("book glyph", ["hh...hh", "hGGhGGs", "GGGhGGs", "GGGhGGs", ".ssGss."]);

// ── Connect: an AI chip (user request 2026-11-10: "an AI-like background for this title,
// premium, minimalist"). Circuit traces leave the chip's sides and end in solder pads; HUD
// corner marks; a node glyph on the divider. The chip's frame, pins and board are CSS. ───────
const CHIP = { T: "#b27718", P: "#f0a500", h: "#ffe680", c: "#2a1c05", b: "#6a86d8" };
function traces(paths, w, h) {
  const g = grid(w, h);
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); g[y][x] = "T"; }
  };
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) line(...path[i], ...path[i + 1]);
    const [px, py] = path[path.length - 1];
    stamp(g, ["hPP", "PcP", "PPP"], px - 1, py - 1);
  }
  return toRows(g);
}
// Left side: the chip's edge is the right column; three traces of different lengths
const TRACES_LEFT = check("traces left", traces([
  [[17, 5], [10, 5], [7, 2], [4, 2]],
  [[17, 12], [2, 12]],
  [[17, 19], [12, 19], [9, 22], [6, 22]],
], 18, 25));
const TRACES_RIGHT = check("traces right", TRACES_LEFT.map((r) => [...r].reverse().join("")));
const HUD = { G: "#f0a500", h: "#ffe680" };
const HUD_MARK = check("hud mark", ["hGGG", "G...", "G...", "G..."]);
const NODE_GLYPH = check("node glyph", ["..h..", ".hPP.", "hPbPP", ".PPP.", "..P.."]);

// ── Output ────────────────────────────────────────────────────────────────────────────────
const sprite = (rows, palette) => ({ w: rows[0].length, h: rows.length, rows, palette });
const SPRITES = {
  cat: sprite(CAT_MAP, CAT),
  mound: sprite(MOUND_MAP, MOUND),
  mark: sprite(MARK_MAP, MARK),
  flower: sprite(FLOWER_MAP, FLOWER),
  tuft: sprite(TUFT_MAP, GRASS),
  gem: sprite(GEM_MAP, GEM),
  star: sprite(STAR_MAP, GEM),
  starSmall: sprite(STAR_SMALL_MAP, GEM),
  book: sprite(BOOK_MAP, BOOK),
  orbitBack: sprite(ORBIT.back, RING),
  orbitFront: sprite(ORBIT.front, RING),
  grassHiLeft: sprite(GRASS_HI_LEFT, GRASS),
  grassHiTile: sprite(GRASS_HI_TILE, GRASS),
  grassStep: sprite(GRASS_STEP, GRASS),
  grassLoTile: sprite(GRASS_LO_TILE, GRASS),
  grassLoRight: sprite(GRASS_LO_RIGHT, GRASS),
  underLeft: sprite(UNDER_LEFT, DIRT),
  underTile: sprite(UNDER_TILE, DIRT),
  underRight: sprite(UNDER_RIGHT, DIRT),
  hole: sprite(HOLE_MAP, DIRT),
  dropBig: sprite(DROP_BIG, DIRT),
  dropSmall: sprite(DROP_SMALL, DIRT),
  frameTL: sprite(FRAME_TL, FRAME),
  frameTR: sprite(FRAME_TR, FRAME),
  cloudTopTile: sprite(CLOUD_TOP_TILE, CLOUD),
  cloudBottomTile: sprite(CLOUD_BOTTOM_TILE, CLOUD),
  cloudLeftTile: sprite(CLOUD_LEFT_TILE, CLOUD),
  cloudRightTile: sprite(CLOUD_RIGHT_TILE, CLOUD),
  cloudCornerTL: sprite(CLOUD_CORNER_TL, CLOUD),
  cloudCornerTR: sprite(CLOUD_CORNER_TR, CLOUD),
  cloudCornerBL: sprite(CLOUD_CORNER_BL, CLOUD),
  cloudCornerBR: sprite(CLOUD_CORNER_BR, CLOUD),
  cloudGem: sprite(GEM_MAP, CLOUD_GEM),
  booksLeft: { w: BOOKS_LEFT.rows[0].length, h: BOOKS_LEFT.rows.length, rows: BOOKS_LEFT.rows, palette: BOOKS_LEFT.palette },
  booksRight: { w: BOOKS_RIGHT.rows[0].length, h: BOOKS_RIGHT.rows.length, rows: BOOKS_RIGHT.rows, palette: BOOKS_RIGHT.palette },
  bracket: sprite(BRACKET, WOOD),
  cornerCap: sprite(CORNER_CAP, WOOD),
  bookGlyph: sprite(BOOK_GLYPH, WOOD),
  tracesLeft: sprite(TRACES_LEFT, CHIP),
  tracesRight: sprite(TRACES_RIGHT, CHIP),
  hudMark: sprite(HUD_MARK, HUD),
  nodeGlyph: sprite(NODE_GLYPH, CHIP),
  cloudStar: sprite(STAR_MAP, CLOUD_GEM),
  cloudStarSmall: sprite(STAR_SMALL_MAP, CLOUD_GEM),
};

const out = `// Generated by design/brand/hero-island.mjs: do not edit by hand.
// Pixel maps of the home title's floating grass island (components/HeroPlaque.tsx). One character
// per art pixel, "." is empty; each sprite carries its own palette, sampled from the reference.

export type IslandSprite = { w: number; h: number; rows: readonly string[]; palette: Readonly<Record<string, string>> };

export const ISLAND = ${JSON.stringify(SPRITES, null, 2)} as const satisfies Record<string, IslandSprite>;
`;
writeFileSync(new URL("../../web/components/brand/island-art.ts", import.meta.url), out);
console.log(Object.entries(SPRITES).map(([k, s]) => `${k} ${s.w}×${s.h}`).join(" · "));
