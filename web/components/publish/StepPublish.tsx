"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LICENSE_TEXT, type Draft } from "@/lib/publish/draft";
import { KIND_INFO, slugify } from "@/lib/publish/templates";
import { byteLength, formatBytes, type ScanResult } from "@/lib/scan";

type Props = {
  draft: Draft;
  scan: ScanResult;
  onReset: () => void;
  // Owned by PublishFlow: consent and the Publish button live in the always-visible footer.
  phase: number; // -1 idle, 0..3 running, 4 done
  setPhase: (update: (p: number) => number) => void;
};

// The real flow (ARCHITECTURE §7.1): server re-scan + IPFS pin → wallet signs → Arc tx → confirm.
export const PHASES = ["Checking your file again", "Uploading to IPFS", "Waiting for your wallet", "Writing to Arc"];
const PHASE_MS = 900;

// Step 4: last look, permanence note, then publish (demo until the registry contract lands, roadmap step 7).
export default function StepPublish({ draft, scan, onReset, phase, setPhase }: Props) {
  useEffect(() => {
    if (phase < 0 || phase >= PHASES.length) return;
    const t = window.setTimeout(() => setPhase((p) => p + 1), PHASE_MS);
    return () => window.clearTimeout(t);
  }, [phase, setPhase]);

  const kept = draft.kept.length;
  const review = scan.counts.review;
  const slug = slugify(draft.meta.title);

  const rows: [string, string][] = [
    ["File", `${slug}.md · ${formatBytes(byteLength(draft.content))}`],
    ["Type", KIND_INFO[draft.meta.kind].label],
    ["License", LICENSE_TEXT],
    ["Tags", draft.meta.tags.join(", ") || "none"],
    ["Clean up", `${draft.replaced} replaced · ${kept} kept on purpose · ${scan.counts.block} ${scan.counts.block === 1 ? "secret" : "secrets"}`],
  ];

  if (phase >= PHASES.length) {
    return (
      <div className="pub-done" role="status">
        <p className="pub-done-title">Demo complete</p>
        <p className="pub-done-text">
          This is what publishing will look like. Nothing was uploaded or written to Arc yet: on-chain publishing
          arrives in a later release. Your draft is still saved in this browser.
        </p>
        <div className="pub-done-actions">
          <Link href="/explore" className="btn-ghost">
            Back to Explore
          </Link>
          <button type="button" className="btn-gold" onClick={onReset}>
            Start a new guideline
          </button>
        </div>
      </div>
    );
  }

  const running = phase >= 0;

  return (
    <div className="pub-final">
      <p className="pub-demo" role="note">
        <strong>Demo mode.</strong> Publishing isn&apos;t linked to your wallet and Arc yet, so this step shows the flow
        without uploading or sending anything.
      </p>

      <dl className="pub-summary">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {review > 0 && (
        <p className="pub-note sev-review">
          {review === 1 ? "1 line was kept for review. A moderator checks it" : `${review} lines were kept for review. A moderator checks them`}{" "}
          before agents can fetch this guideline over MCP.
        </p>
      )}

      <div className="pub-cost">
        <p>
          <strong>Network fee.</strong> Publishing writes a record to Arc from your own wallet. You pay a small gas fee in
          USDC, usually less than a cent. PikaMd takes no fee.
        </p>
      </div>

      {running && (
        <ol className="pub-phases" aria-live="polite">
          {PHASES.map((p, i) => (
            <li key={p} className={i < phase ? "is-done" : i === phase ? "is-now" : ""}>
              <span aria-hidden="true">{i < phase ? "✓" : i === phase ? "▶" : "·"}</span> {p}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
