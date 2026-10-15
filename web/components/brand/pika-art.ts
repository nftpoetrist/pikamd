// PikaMd mascot: a pika (Ochotona), the small mountain mammal that gathers and stores hay for
// the winter: a collector, like a guideline collection. Original pixel art drawn for PikaMd
// (2026-10-15; how it was made: design/brand/mascot.mjs). Round, pale-rimmed ears, long whiskers,
// no tail, holding a .md page. One letter per pixel, "." is transparent; colors in PIKA_PALETTE.
// Used by components/brand/PikaSprite.tsx (navbar) and design/brand/build-icons.mjs (favicons,
// social images), so every picture of the mascot comes from these maps.

export const PIKA_PALETTE: Record<string, string> = {
  O: "#1A0800", // outline (--ink)
  K: "#1A0800", // eyes
  E: "#FFFFFF", // eye shine
  D: "#7A4200", // deepest fur shade (--g4), mouth
  S: "#C47A00", // fur shade (--g3)
  M: "#E08A00", // fur mid (--g2)
  B: "#F0A500", // fur (--g1)
  L: "#FFD740", // fur light (--y2)
  C: "#FFE8B0", // cream: ear rims, muzzle, paws, feet
  W: "#FFF8E7", // muzzle shine (--t0)
  P: "#F2A08A", // inner ear
  p: "#C9705E", // inner ear shade
  N: "#7A2E22", // nose
  w: "#FFE9C2", // whiskers (light, so they read on dark backgrounds)
  X: "#FFF8E7", // page
  x: "#E9D9B4", // page shade
  l: "#B08A4A", // page text lines
  f: "#D8C49A", // folded corner
};

/** 32×32, the full mascot holding a page. */
export const PIKA: readonly string[] = [
  "......OOOO............OOOO......",
  ".....OCCCCO..........OCCCCO.....",
  "....OCLBBLCO........OCLBBLCO....",
  "...OCLBBBBBCO......OCBBBBBBCO...",
  "...OCBBPPPBMCOOOOOOCLBPPPBBCO...",
  "...OCBBPPPpMCOLLLLOCBpPPPBBCO...",
  "...OLBpPppLLLLLLLLLLLLppPpBMO...",
  "...OBBBpLLLLLLLLLLLLLLBBpBMDO...",
  "....OMMLLLLLBBBBBBBBBBBBBMDO....",
  ".....OLLLLBBBBBBBBBBBBBBBBO.....",
  "....OLLLLBBBBBBBBBBBBBBBMMMO....",
  "....OLLLBBBBBBBBBBBBBBBBMMSO....",
  "....OLLLBBEKBBBBBBBBEKBBMMSO....",
  "...OLLLBBBKKBBBBBBBBKKBBMMSSO...",
  "ww.OLLLLBBKKBBBBBBBBKKBBMMSDO.ww",
  "..wwOLLBBBBBBCCCCCCBBBBBMMSOww..",
  "....OBBBSSBBCWWNNCCCBBSSMSDO....",
  "..ww.OBBBBBCCCCCCCCCCBMMSDO.ww..",
  "ww....OBSSMCCCDCCDCCCMSSSO....ww",
  "......OSMMMMCCCDDCCCMSSSSO......",
  "......OLSSOOOOOOOOOOOSSSMO......",
  ".....OLLLBOXXXXXXXXXfOBMMSO.....",
  ".....OLLOOOXlllllXXXxOOOMSO.....",
  ".....OLOCCCOXXXXXXXXOCCCOSO.....",
  ".....OLOCCCOlllllllXOCCCOSO.....",
  ".....OLOxCCOXXXXXXXXOCCxODO.....",
  "......OBOOOXllllllXXxOOOSO......",
  "......OBBBOxxxxxxxxxxOMSDO......",
  ".......OBBOOOOOOOOOOOOSDO.......",
  "........OMMCCxMMMMCCxDDO........",
  ".........OOSSSSSDDDDDOO.........",
  "...........OOOOOOOOOO...........",
];

/** Closed eyes: drawn over PIKA for a blink (fur over the eye, a line on its bottom row). */
export const PIKA_LIDS: readonly { x: number; y: number; c: string }[] = [
  { x: 10, y: 12, c: "B" },
  { x: 11, y: 12, c: "B" },
  { x: 10, y: 13, c: "B" },
  { x: 11, y: 13, c: "B" },
  { x: 10, y: 14, c: "K" },
  { x: 11, y: 14, c: "K" },
  { x: 20, y: 12, c: "B" },
  { x: 21, y: 12, c: "B" },
  { x: 20, y: 13, c: "B" },
  { x: 21, y: 13, c: "B" },
  { x: 20, y: 14, c: "K" },
  { x: 21, y: 14, c: "K" },
];

/** 16×16 head, for favicons (the full mascot doesn't read at 16 px). */
export const PIKA_HEAD: readonly string[] = [
  "..OOO......OOO..",
  ".OCCCO....OCCCO.",
  ".OCPBOOOOOOBPSO.",
  "OLBpLLLLLLLLpBMO",
  "OLBBLLBBBBBBBBMO",
  "OLLBBBBBBBBBBBMO",
  "OLBBEKBBBBEKBMSO",
  "OLBBKKBBBBKKBMSO",
  "OLBBBBCNNCBBBMSO",
  "OLBBBCCCCCCBBMSO",
  ".OBBBBCCCCBBBMO.",
  ".OBBBBBBBBBBMSO.",
  "..OBBBBBBBBMSO..",
  "...OOMMMMMSOO...",
  ".....OOOOOO.....",
  "................",
];
