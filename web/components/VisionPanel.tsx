import PixelGlyph, { type GlyphName } from "@/components/PixelGlyph";

// "How PikaMd works" — the vision in four squares, right under the home trading cards.
// Share → Collect → Connect → Stay safe (K15), then the sentence the whole product exists for (ARCHITECTURE.md §1).
const STEPS: { glyph: GlyphName; title: string; text: string }[] = [
  { glyph: "file", title: "Share", text: "Publish a .md file that makes agents better. We help you strip private data first" },
  { glyph: "collect", title: "Collect", text: "Add the guidelines you trust to your collection. Reading is always free" },
  { glyph: "plug", title: "Connect", text: "Connect your agent once over MCP: Claude Code, Cursor, VS Code, Codex and more" },
  { glyph: "shield", title: "Stay safe", text: "Files are scanned for secrets and harmful instructions. Pinned versions never change behind your back" },
];

const PROMISES = ["No account needed to read", "Authors recorded on Arc", "Works with any MCP agent", "0% platform fee"];

export default function VisionPanel() {
  return (
    <section className="vision-panel pixel-panel" aria-labelledby="vision-heading">
      <header className="vision-head">
        <p className="vision-eyebrow">How PikaMd works</p>
        <h2 id="vision-heading" className="vision-heading">
          One library <span>for every agent</span>
        </h2>
        <p className="vision-lead">
          <span>People share the guideline files that make their agents better</span>{" "}
          <span>You pick the ones you trust, and your agent reads them straight from your collection</span>
        </p>
      </header>

      <ol className="vision-steps">
        {STEPS.map(({ glyph, title, text }, i) => (
          <li key={title} className="vision-step">
            <div className="vision-step-top">
              <span className="vision-step-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <PixelGlyph name={glyph} />
            </div>
            <h3 className="vision-step-title">{title}</h3>
            <p className="vision-step-text">{text}</p>
          </li>
        ))}
      </ol>

      <figure className="vision-term">
        <figcaption className="vision-term-label">For example, in your agent</figcaption>
        <div className="vision-term-body">
          <p className="vision-term-ask">
            <span aria-hidden="true">&gt; </span>
            Fill the gaps in my CLAUDE.md using the Secure Solidity guideline from my PikaMd collection
            <span className="vision-term-cursor" aria-hidden="true" />
          </p>
          <p className="vision-term-out">
            <span aria-hidden="true">✓ </span>my_collection · 4 guidelines found
          </p>
          <p className="vision-term-out">
            <span aria-hidden="true">✓ </span>get_guideline · secure-solidity@v3
          </p>
          <p className="vision-term-out">
            <span aria-hidden="true">✓ </span>Compared with your CLAUDE.md and filled the gaps
          </p>
        </div>
      </figure>

      <ul className="vision-promises" aria-label="What you can count on">
        {PROMISES.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}
