import { PIKA, PIKA_PALETTE } from "@/components/brand/pika-art";

// The two little cats that run on the home plaque's top edge (components/HeroPlaque.tsx): the
// navbar mascot itself (components/brand/pika-art.ts, page in its paws), given two short legs
// under its belly. A four-frame trot: one paw planted while the other lifts, with a 2px hop
// between, and pixel dust behind the planted paw. Everything above the belly is the mascot
// unchanged, so the cats always match the logo. Gold for PikaMd; the right-hand cat wears the Arc
// card's blues (VisionCards 002). The maps face left (the tail trails on the right); CSS mirrors
// them. 32×35, one letter per pixel, "." is transparent; paws stand on row 33 (2026-10-25).

type Px = readonly [x: number, y: number, c: string];

const W = PIKA[0].length;
const TOP = 1; // one more empty row above the mascot (its own row 0 is empty too): room to hop 2px
const BODY = TOP + 29; // the mascot's body outline row; its round belly below is replaced by legs
const H = BODY + 5; // two rows of leg, a row of paw, its outline
const LEGS = [10, 19] as const; // left edge of each 3px leg

/** A leg either stands (fur, then a paw on the ground row) or is lifted (paw tucked, one pixel back). */
function leg(a: number, down: boolean): Px[] {
  const out: Px[] = [];
  const span = (x0: number, y: number, c: string) => { for (let x = x0; x < x0 + 3; x++) out.push([x, y, c]); };
  if (down) {
    for (const y of [BODY + 1, BODY + 2]) { out.push([a - 1, y, "O"], [a + 3, y, "O"]); span(a, y, "B"); out.push([a + 2, y, "M"]); }
    out.push([a - 1, BODY + 3, "O"], [a + 3, BODY + 3, "O"]); span(a, BODY + 3, "C");
    span(a, BODY + 4, "O");
  } else {
    const b = a + 1;
    out.push([b - 1, BODY + 1, "O"], [b + 3, BODY + 1, "O"]); span(b, BODY + 1, "C");
    span(b, BODY + 2, "O");
  }
  return out;
}

function frame(left: boolean, right: boolean, dust: Px[], hop: number): string[] {
  const g = Array.from({ length: H }, (_, y) => {
    const src = y - TOP;
    return src >= 0 && src <= 29 ? [...PIKA[src]] : Array<string>(W).fill(".");
  });
  for (const [x, y, c] of [...leg(LEGS[0], left), ...leg(LEGS[1], right)]) g[y][x] = c;
  for (const [x, y, c] of dust) if (g[y][x] === ".") g[y][x] = c;
  const rows = g.map((r) => r.join(""));
  // In the air: everything `hop` pixels up (the top rows are empty)
  return [...rows.slice(hop), ...Array<string>(hop).fill(".".repeat(W))];
}

const G = BODY + 3; // the ground row (paws)

// Moving left, so the dust trails to the right of the planted paw
export const RUN_FRAMES: readonly (readonly string[])[] = [
  frame(true, false, [[14, G, "d"], [15, G - 1, "e"]], 0),
  frame(false, false, [[16, G - 1, "e"]], 2),
  frame(false, true, [[23, G, "d"], [24, G - 1, "e"]], 0),
  frame(false, false, [[25, G - 1, "e"]], 2),
];

/** Standing still at the end of a run: both paws down, no dust. */
export const STAND: readonly string[] = frame(true, true, [], 0);

export const RUN_GOLD: Record<string, string> = {
  ...PIKA_PALETTE,
  d: "#FFE8B0", // dust
  e: "#B88A3A", // fading dust
};

export const RUN_BLUE: Record<string, string> = {
  ...PIKA_PALETTE,
  O: "#050A1C", // outline (navy ink)
  K: "#050A1C", // eyes
  D: "#2E4183", // deepest fur shade, mouth
  S: "#4E66B8", // fur shade
  M: "#6A86D8", // fur mid, tabby stripes
  B: "#8FAAF0", // fur
  L: "#C9D6FF", // fur light
  C: "#EEF2FF", // muzzle, paws
  d: "#DDE6FF", // dust
  e: "#6A86D8", // fading dust
};
