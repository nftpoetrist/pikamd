// The site's background: a warm pixel night sky with blocky clouds, floating gold bits and a few
// twinkling sparkles (the Squeaksy-style skin in PikaMd's colors, DESIGN.md §1). Static markup, no
// JavaScript: the clouds don't move, only the sparkles blink (opacity, in steps). Colors live in
// globals.css (SQUEAKSY SKIN → .sky-*), so the whole sky follows the palette tokens.

type Rect = readonly [x: number, y: number, w: number, h: number];

// Cloud shapes on a pixel grid: body, a darker underside and a lit top edge
const CLOUDS = {
  wide: {
    w: 64,
    h: 24,
    body: [[4, 14, 56, 8], [10, 9, 20, 6], [22, 3, 22, 12], [40, 8, 16, 7], [1, 17, 62, 5]] as Rect[],
    shade: [[1, 21, 62, 2]] as Rect[],
    lit: [[26, 3, 12, 1], [12, 9, 8, 1], [42, 8, 8, 1]] as Rect[],
  },
  small: {
    w: 44,
    h: 18,
    body: [[3, 10, 38, 6], [8, 5, 16, 6], [18, 2, 14, 9], [29, 6, 10, 5], [1, 12, 42, 4]] as Rect[],
    shade: [[1, 15, 42, 2]] as Rect[],
    lit: [[20, 2, 8, 1], [9, 5, 6, 1]] as Rect[],
  },
} as const;

// Where they float: left and top in % of the screen, pixel scale (whole numbers stay sharp)
const PLACES: { shape: keyof typeof CLOUDS; left: string; top: string; scale: number }[] = [
  { shape: "wide", left: "4%", top: "11%", scale: 4 },
  { shape: "small", left: "73%", top: "15%", scale: 4 },
  { shape: "small", left: "31%", top: "33%", scale: 3 },
  { shape: "wide", left: "86%", top: "45%", scale: 3 },
  { shape: "small", left: "1%", top: "57%", scale: 5 },
  { shape: "wide", left: "53%", top: "77%", scale: 3 },
];

// Floating gold squares (a frame with a dark middle), like loose pixels in the sky
const BITS: { left: string; top: string; size: number }[] = [
  { left: "6%", top: "24%", size: 18 },
  { left: "95%", top: "31%", size: 21 },
  { left: "88%", top: "71%", size: 15 },
  { left: "10%", top: "86%", size: 15 },
  { left: "62%", top: "7%", size: 12 },
  { left: "41%", top: "91%", size: 18 },
];

// Four-point sparkles, each blinking on its own beat
const SPARKS: { left: string; top: string; delay: string }[] = [
  { left: "18%", top: "21%", delay: "0s" },
  { left: "67%", top: "27%", delay: "-1.3s" },
  { left: "44%", top: "52%", delay: "-2.2s" },
  { left: "92%", top: "58%", delay: "-0.6s" },
  { left: "24%", top: "71%", delay: "-3.1s" },
  { left: "79%", top: "88%", delay: "-1.8s" },
];

const rects = (list: readonly Rect[]) => list.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join("");

export default function PixelSky() {
  return (
    <div className="scene sky" aria-hidden="true">
      {PLACES.map(({ shape, left, top, scale }, i) => {
        const c = CLOUDS[shape];
        return (
          <svg
            key={i}
            className="sky-cloud"
            width={c.w * scale}
            height={c.h * scale}
            viewBox={`0 0 ${c.w} ${c.h}`}
            shapeRendering="crispEdges"
            style={{ left, top }}
          >
            <path className="sky-cloud-body" d={rects(c.body)} />
            <path className="sky-cloud-shade" d={rects(c.shade)} />
            <path className="sky-cloud-lit" d={rects(c.lit)} />
          </svg>
        );
      })}
      {BITS.map(({ left, top, size }, i) => (
        <span key={i} className="sky-bit" style={{ left, top, width: size, height: size }} />
      ))}
      {SPARKS.map(({ left, top, delay }, i) => (
        <span key={i} className="sky-spark" style={{ left, top, animationDelay: delay }} />
      ))}
    </div>
  );
}
