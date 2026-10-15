// Original pixel blocks (design/brand/blocks.mjs): three isometric blocks with a gold "final"
// check, for the "Built on Arc" card (fast blocks, final in one confirmation), and one small gold
// block for the footer. Not Arc's logo: Arc's brand rules allow only the official files, unaltered
// and at least 50 px tall (arc.io/brand-guidelines-and-partner-toolkit, circle.com/pressroom).

const BLOCKS = [
  "............OOTTOO.......OOOOO..",
  "..........OOttTTttOO....OhhhhGO.",
  ".........OttTTTTTTttO..OhGGGGkGO",
  "........OATTTTTTTTTTRO.OhGGGkksO",
  "........OAaaTTTTTTrrRO.OGkGkkGsO",
  "........OAAAaaTTrrRRRO.OGkkkGGsO",
  "......OOtTAAAAarRRRRTtOOGGkGGssO",
  "....OOttTTTTAAaRRRTTTTttOGssssO.",
  "...OttTTTTTTTTaRTTTTTTTTtOOOOO..",
  "..OATTTTTTTTTTRATTTTTTTTTTRO....",
  "..OAaaTTTTTTrrRAaaTTTTTTrrRO....",
  "..OAAAaaTTrrRRRAAAaaTTrrRRRO....",
  "..OAAAAAarRRRRRAAAAAarRRRRRO....",
  "..OAAAAAaRRRRRRAAAAAaRRRRRRO....",
  "...OAAAAaRRRRROOAAAAaRRRRRO.....",
  "....OOAAaRRROO..OOAAaRRROO......",
  "......OOaROO......OOaROO........",
  "........OO..........OO..........",
];

const BLOCKS_COLORS: Record<string, string> = {
  O: "#050A1C", // outline (navy ink)
  T: "#C9D3EE", // top faces
  t: "#FFFFFF", // top face light edge
  A: "#7E93CC", // left faces
  a: "#9FB3E6", // left face light edge
  R: "#3B5199", // right faces
  r: "#5068B0", // right face edge
  G: "#FFCB05", // badge (--y1)
  h: "#FFE680", // badge light
  s: "#C47A00", // badge shade (--g3)
  k: "#1A0800", // check mark (--ink)
};

const BLOCK = [
  ".....OO.....",
  "...OOttOO...",
  ".OOttTTttOO.",
  "OttTTTTTTttO",
  "OaaTTTTTTrrO",
  "OAAaaTTrrRRO",
  "OAAAAarRRRRO",
  "OAAAAARRRRRO",
  "OAAAAARRRRRO",
  ".OOAAARRROO.",
  "...OOAROO...",
  ".....OO.....",
];

const BLOCK_COLORS: Record<string, string> = {
  O: "#1A0800", // outline (--ink)
  T: "#FFD740", // top (--y2)
  t: "#FFF1C2", // top light edge
  A: "#F0A500", // left (--g1)
  a: "#FFCB05", // left edge (--y1)
  R: "#C47A00", // right (--g3)
  r: "#E08A00", // right edge (--g2)
};

function runs(map: readonly string[], colors: Record<string, string>) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") out.push({ x, y, w: end - x, fill: colors[ch] });
      x = end;
    }
  });
  return out;
}

const BLOCKS_RUNS = runs(BLOCKS, BLOCKS_COLORS);
const BLOCK_RUNS = runs(BLOCK, BLOCK_COLORS);

function Pixels({ map, cells, scale, className }: { map: readonly string[]; cells: ReturnType<typeof runs>; scale: number; className?: string }) {
  const w = map[0].length, h = map.length;
  return (
    <svg className={className} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {cells.map(({ x, y, w: rw, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={rw} height={1} fill={fill} />
      ))}
    </svg>
  );
}

/** Three blocks and a gold check (32×18 pixels). */
export function PixelBlocks({ scale = 3 }: { scale?: number }) {
  return <Pixels map={BLOCKS} cells={BLOCKS_RUNS} scale={scale} />;
}

/** One small gold block (12×12 pixels). */
export function PixelBlock({ scale = 2, className }: { scale?: number; className?: string }) {
  return <Pixels map={BLOCK} cells={BLOCK_RUNS} scale={scale} className={className} />;
}
