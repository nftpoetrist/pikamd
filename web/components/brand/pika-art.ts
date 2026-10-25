// PikaMd mascot: a tabby cat holding a .md page, the collector of the guideline library. Original
// pixel art drawn for PikaMd (2026-10-25, replacing the pika; how it was made:
// design/brand/mascot.mjs). Pointed ears with pink insides, tabby stripes, pink nose, long
// whiskers, a striped tail curled up its right side. One letter per pixel, "." is transparent;
// colors in PIKA_PALETTE. Used by components/brand/PikaSprite.tsx (navbar) and
// design/brand/build-icons.mjs (favicons, social images), so every picture of the mascot comes
// from these maps.

export const PIKA_PALETTE: Record<string, string> = {
  O: "#1A0800", // outline (--ink)
  K: "#1A0800", // eyes
  E: "#FFFFFF", // eye shine
  D: "#7A4200", // deepest fur shade (--g4), mouth
  S: "#C47A00", // fur shade (--g3)
  M: "#E08A00", // fur mid (--g2), tabby stripes
  B: "#F0A500", // fur (--g1)
  L: "#FFD740", // fur light (--y2)
  C: "#FFE8B0", // cream: muzzle, paws
  P: "#F2A08A", // inner ear, nose
  p: "#C9705E", // inner ear and nose shade
  w: "#FFE9C2", // whiskers (light, so they read on dark backgrounds)
  X: "#FFF8E7", // page
  x: "#E9D9B4", // page shade
  l: "#B08A4A", // page text lines
  f: "#D8C49A", // folded corner
};

/** 32×32, the full mascot holding a page. */
export const PIKA: readonly string[] = [
  "................................",
  ".....OO..................OO.....",
  "....OLLO................OBBO....",
  "....OLLLOO............OOBBBO....",
  "...OBBPBBBO..........OMMMPMMO...",
  "...OBBPPBBBO........OMMMPPMMO...",
  "...OBPPPPPBBOOOOOOOOMMPPPPPMO...",
  "...OBPPPppLLLLLLLLLLLLppPPPMO...",
  "...OBpppLLLLLLLMMLLLLLBBpppMO...",
  "..OBBBLLLLLBMBBMMBBMBBBBBBMMMO..",
  "..OBBLLLLBBBMBBBBBBMBBBBBBBMDO..",
  "...OLLLLBBBBBBBBBBBBBBBBMMMMO...",
  "...OLLLBBBBBBBBBBBBBBBBBMMSSO...",
  "...OLLLBBBEKBBBBBBBBEKBBBMMSO...",
  "...OLMMBBBKKBBBBBBBBKKBBBSSSO...",
  "ww.OLLLBBBKKBBBBBBBBKKBBBMMSO.ww",
  "..wwLMMBBBBBBBPPPPBBBBBBMSSDww..",
  "....OBBBBBBBCCCppCCCBBBMMSSO....",
  "wwwwOBBBBBBBCCDCCDCCBBMMMDDOwwww",
  "...w.OOBMMMMCCCDDCCCMMMSDOO.w...",
  "www...OSMMSMMMCCCCMMMSSSO..OOwww",
  ".....OLLSSOOOOOOOOOOOSSSMOOLLO..",
  ".....OLLLBOXXXXXXXXXfOMMSO.OLSO.",
  ".....OLLOOOXlllllXXXxOOOSO.OMMO.",
  ".....OLOCCCOXXXXXXXXOCCCOO.OLSO.",
  ".....OLOCCCOlllllllXOCCCOO.OLSO.",
  ".....OBOxCCOXXXXXXXXOCCxOOOLMMO.",
  "......OBOOOXllllllXXxOOOOOLBSO..",
  ".......OBBOxxxxxxxxxxODDSSSSO...",
  "........OMOOOOOOOOOOOOOOOOOO....",
  ".........OSSSSMMMDDDDO..........",
  "..........OOOOSSDOOOO...........",
];

/** Closed eyes: drawn over PIKA for a blink (fur over the eye, a line on its bottom row). */
export const PIKA_LIDS: readonly { x: number; y: number; c: string }[] = [
  { x: 10, y: 13, c: "B" },
  { x: 11, y: 13, c: "B" },
  { x: 10, y: 14, c: "B" },
  { x: 11, y: 14, c: "B" },
  { x: 10, y: 15, c: "K" },
  { x: 11, y: 15, c: "K" },
  { x: 20, y: 13, c: "B" },
  { x: 21, y: 13, c: "B" },
  { x: 20, y: 14, c: "B" },
  { x: 21, y: 14, c: "B" },
  { x: 20, y: 15, c: "K" },
  { x: 21, y: 15, c: "K" },
];

/** 16×16 head for favicons: plain fur and big eyes, so it reads in a browser tab. */
export const PIKA_HEAD: readonly string[] = [
  ".O............O.",
  "OLO..........OBO",
  "OLLO........OBMO",
  "OLPLO......OBPMO",
  "OLPPLOOOOOOLPPMO",
  "OLLLLLLLLLLLLLMO",
  "OLLBBBBBBBBBBBMO",
  "OLBBEKBBBBEKBBMO",
  "OLBBKKBBBBKKBBMO",
  "OLBBKKBBBBKKBMSO",
  "OLBBBBCPPCBBBMSO",
  ".OBBBCDCCDCBBMO.",
  ".OMBBBCDDCBBMSO.",
  "..OMMBBBBBBMSO..",
  "...OOMMMMMMOO...",
  ".....OOOOOO.....",
];
