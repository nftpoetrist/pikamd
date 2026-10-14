"use client";

import Link from "next/link";
import { useConnection } from "wagmi";
import { CHAIN } from "@/lib/chain";
import { DONE, PHASES, type usePublish } from "@/lib/publish/client";
import { LICENSE_TEXT, type Draft } from "@/lib/publish/draft";
import { KIND_INFO, slugify } from "@/lib/publish/templates";
import { byteLength, formatBytes, type ScanResult } from "@/lib/scan";

type Props = {
  draft: Draft;
  scan: ScanResult;
  onReset: () => void;
  // Owned by PublishFlow: the Publish button lives in the always-visible footer.
  publish: ReturnType<typeof usePublish>;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const txUrl = (hash: string) => `${CHAIN.blockExplorers?.default.url}/tx/${hash}`;

// Step 4: last look, then publish for real (ARCHITECTURE §7.1): the server checks and pins the
// file, the author's own wallet registers it on Arc, the server confirms it from the receipt.
export default function StepPublish({ draft, scan, onReset, publish }: Props) {
  const { address, status } = useConnection();
  const { phase, error, result, pendingTx } = publish;

  const kept = draft.kept.length;
  const review = scan.counts.review;
  const slug = slugify(draft.meta.title);

  if (phase >= DONE && result) {
    return (
      <div className="pub-done" role="status">
        <p className="pub-done-title">Published</p>
        <p className="pub-done-text">
          <strong>{draft.meta.title}</strong> is on IPFS and recorded on Arc under your wallet. It&apos;s on Explore now.
        </p>
        <div className="pub-done-actions">
          <Link href={`/explore?q=${encodeURIComponent(result.slug)}`} className="btn-ghost">
            See it on Explore
          </Link>
          <a href={txUrl(result.txHash)} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            View on Arc ↗
          </a>
          <button type="button" className="btn-gold" onClick={onReset}>
            Start a new guideline
          </button>
        </div>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["File", `${slug}.md · ${formatBytes(byteLength(draft.content))}`],
    ["Type", KIND_INFO[draft.meta.kind].label],
    ["License", LICENSE_TEXT],
    ["Tags", draft.meta.tags.join(", ") || "none"],
    ["Clean up", `${draft.replaced} replaced · ${kept} kept on purpose · ${scan.counts.block} ${scan.counts.block === 1 ? "secret" : "secrets"}`],
    ["Wallet", status === "connected" && address ? short(address) : "not connected"],
  ];
  const running = phase >= 0 && phase < DONE;

  return (
    <div className="pub-final">
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

      {pendingTx && !running && (
        <p className="pub-note" role="note">
          Your guideline is already written to Arc (
          <a href={txUrl(pendingTx)} target="_blank" rel="noopener noreferrer">
            {short(pendingTx)}
          </a>
          ). Press <strong>Finish publishing</strong> to add it to PikaMd. This doesn&apos;t send anything again.
        </p>
      )}

      {error && (
        <p className="pub-note pub-error" role="alert">
          {error}
        </p>
      )}

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
