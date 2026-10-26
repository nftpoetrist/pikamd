// Pixel art as SVG paths: one <path> per color instead of one <rect> per pixel or run
// (2026-10-26). Same pixels: integer coordinates under shape-rendering="crispEdges" cover exactly
// the cells the rects did. Far fewer DOM nodes: the home page had 5,601 rects, and React builds,
// the browser paints and the page transition snapshots every one of them.
//
// Grouping by color only keeps the picture when no two runs of different colors overlap, which
// holds for runs taken from one grid (each cell has one color). Layers that overlap stay separate.
// Paths need a whole-number scale and whole-pixel transforms to stay crisp (rects snap one by one).

export type PixelRun = { x: number; y: number; w?: number; h?: number; fill: string };
export type ColorPath = { fill: string; d: string };

/** One path per color, in order of first appearance; side-by-side cells in a row become one run. */
export function colorPaths(runs: readonly PixelRun[]): ColorPath[] {
  const byColor = new Map<string, PixelRun[]>();
  for (const r of runs) {
    let list = byColor.get(r.fill);
    if (!list) byColor.set(r.fill, (list = []));
    list.push(r);
  }
  return [...byColor].map(([fill, list]) => ({ fill, d: runsPath(merge(list)) }));
}

/** One path for runs that share a color set elsewhere (a parent's fill or CSS). */
export const runsPath = (runs: readonly Omit<PixelRun, "fill">[]): string =>
  runs.map((r) => `M${r.x} ${r.y}h${r.w ?? 1}v${r.h ?? 1}h${-(r.w ?? 1)}z`).join("");

/**
 * Side-by-side cells of one color in a row as one run, for art that must stay <rect>s: a path drawn
 * at a non-whole scale (e.g. 16 pixels in 56px) gets soft edges, rects each snap to the pixel grid.
 */
export const mergeRuns = (runs: readonly PixelRun[]): PixelRun[] => {
  const byColor = new Map<string, PixelRun[]>();
  for (const r of runs) {
    let list = byColor.get(r.fill);
    if (!list) byColor.set(r.fill, (list = []));
    list.push(r);
  }
  return [...byColor.values()].flatMap(merge);
};

// One-row runs that touch in the same row join up (same color, so the same pixels)
function merge(list: readonly PixelRun[]): PixelRun[] {
  const sorted = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: PixelRun[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    const h = r.h ?? 1;
    if (last && (last.h ?? 1) === 1 && h === 1 && last.y === r.y && last.x + (last.w ?? 1) === r.x) last.w = (last.w ?? 1) + (r.w ?? 1);
    else out.push({ ...r, w: r.w ?? 1, h });
  }
  return out;
}
