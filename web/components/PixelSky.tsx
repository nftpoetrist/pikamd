// The site's base background (user requests 2026-11-10: "a minimalist starry night sky… on every
// page, it is our base background now"): the night itself and its pixel star field are CSS
// (globals.css → .scene, in the Arc sea's blues); this adds a few four-point sparkles that blink on
// their own beat (opacity in steps, on the compositor; still with reduced motion). No JavaScript.

// left and top in % of the screen; each one blinks on its own beat
const SPARKS: { left: string; top: string; delay: string }[] = [
  { left: "18%", top: "21%", delay: "0s" },
  { left: "67%", top: "27%", delay: "-1.3s" },
  { left: "44%", top: "52%", delay: "-2.2s" },
  { left: "92%", top: "58%", delay: "-0.6s" },
  { left: "24%", top: "71%", delay: "-3.1s" },
  { left: "79%", top: "88%", delay: "-1.8s" },
];

export default function PixelSky() {
  return (
    <div className="scene sky" aria-hidden="true">
      {SPARKS.map(({ left, top, delay }, i) => (
        <span key={i} className="sky-spark" style={{ left, top, animationDelay: delay }} />
      ))}
    </div>
  );
}
