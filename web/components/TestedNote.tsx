// "Tested with" (2026-10-31): a small slip of paper clipped to the card's top-right corner, saying
// which agents the author tested this version with. No storage yet (lib/data/tested-preview.ts).
// Paper colors are the mascot's .md page (pika-art.ts); the clip is card 002's silver.

// 5×12 paper clip, drawn at 2× (10×24px): light outer wire, shaded right and bottom side, the inner
// wire joined at the bottom.
const CLIP_LIGHT = "M1 0h3v1H1zM0 1h1v10H0zM2 2h1v9H2z";
const CLIP_SHADE = "M4 1h1v10H4zM1 11h3v1H1z";

const SHOWN = 2;

export default function TestedNote({ agents, version }: { agents?: string[]; version: number }) {
  if (!agents?.length) return null;
  const shown = agents.slice(0, SHOWN);
  const more = agents.length - shown.length;
  const note = `Tested with ${agents.join(", ")}: the author says they tried v${version} with these agents`;

  return (
    <div className="md-tested" role="note" aria-label={note}>
      <svg className="md-tested-clip" width="10" height="24" viewBox="0 0 5 12" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="#C9D3EE" d={CLIP_LIGHT} />
        <path fill="#8D9BC2" d={CLIP_SHADE} />
      </svg>
      <div className="md-tested-paper" aria-hidden="true">
        <span className="md-tested-label">TESTED</span>
        {shown.map((a, i) => (
          <span key={a} className="md-tested-agent">
            {a}
            {i === shown.length - 1 && more > 0 && <b> +{more}</b>}
          </span>
        ))}
      </div>
      <span className="md-tested-tip" aria-hidden="true">
        <b>Tested with:</b> {agents.join(" · ")}. The author says they tried v{version} with these agents
      </span>
    </div>
  );
}
