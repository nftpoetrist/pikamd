"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import StepBar, { STEPS } from "@/components/publish/StepBar";
import StepCleanup, { openCount } from "@/components/publish/StepCleanup";
import StepDetails, { detailsProblem } from "@/components/publish/StepDetails";
import StepFile from "@/components/publish/StepFile";
import StepPublish from "@/components/publish/StepPublish";
import { useLibrary } from "@/lib/library/client";
import { DONE, usePublish } from "@/lib/publish/client";
import { EMPTY_DRAFT, clearDraft, loadDraft, saveDraft, type Draft, type Step } from "@/lib/publish/draft";
import { guessMeta } from "@/lib/publish/templates";
import { MAX_BYTES, byteLength, scanGuideline, stripInvisible } from "@/lib/scan";
import type { GuidelineCard } from "@/lib/types";

// Publish quest: File → Clean up → Details → Publish (ARCHITECTURE §3 Scenario A, §9.1.1).
// Clean up can't be skipped: each step unlocks only when the one before it is complete.
export default function PublishFlow({ guidelines }: { guidelines: GuidelineCard[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  // Names already published, from the page's shell, refreshed when the page opens
  const library = useLibrary(guidelines);
  const takenSlugs = useMemo(() => library.map((g) => g.slug), [library]);

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);
  // Publish step state lives here so its button can sit in the footer.
  const publish = usePublish(draft, update);
  const busy = publish.phase >= 0 && publish.phase < DONE;
  const published = publish.phase >= DONE;

  // The draft lives in this browser: restore it once, then save every change until it's
  // published. Once it is, it's gone from storage: the next visit starts a new guideline, while
  // this one keeps showing "Published".
  useEffect(() => {
    const saved = loadDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage after hydration
    if (saved) setDraft(saved);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (published) {
      clearDraft();
      return;
    }
    const t = window.setTimeout(() => saveDraft(draft), 300);
    return () => window.clearTimeout(t);
  }, [draft, ready, published]);

  const scan = useMemo(() => scanGuideline(draft.content, draft.privateTerms), [draft.content, draft.privateTerms]);

  const bytes = byteLength(draft.content);
  const fileProblem = !draft.content.trim() || draft.content.trim() === "#" ? "Add a file or write your guideline first." : bytes > MAX_BYTES ? "This file is over the size limit." : null;
  const open = openCount(scan, draft.kept);
  const cleanupProblem = open > 0 ? `Decide on ${open} ${open === 1 ? "item" : "items"} to continue.` : null;
  const metaProblem = detailsProblem(draft.meta, takenSlugs, draft.privateTerms);

  // Furthest step the author may open.
  const reachable: Step = fileProblem ? 1 : cleanupProblem ? 2 : metaProblem ? 3 : 4;
  const step: Step = Math.min(draft.step, reachable) as Step;
  const problem = step === 1 ? fileProblem : step === 2 ? cleanupProblem : step === 3 ? metaProblem : null;

  const go = (next: Step) => {
    // Pasted text can carry invisible characters too: strip them on the way out of the editor.
    if (step === 1 && next > 1) {
      const { text, removed } = stripInvisible(draft.content);
      if (removed) update({ content: text, invisibleRemoved: draft.invisibleRemoved + removed });
    }
    // Entering Details: prefill from the cleaned file, so nothing removed in Clean up comes back on the card.
    if (next === 3 && (!draft.meta.title || !draft.meta.description)) {
      const guess = guessMeta(draft.content);
      update({ meta: { ...draft.meta, title: draft.meta.title || guess.title || "", description: draft.meta.description || guess.description || "" } });
    }
    update({ step: next });
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const reset = () => {
    clearDraft();
    setDraft(EMPTY_DRAFT);
    publish.reset();
  };

  // Next keeps a visited page's state while it's hidden, so leaving after a publish would bring
  // the published file back with the page. React runs this cleanup when the page is hidden or
  // left: the next visit starts a new guideline.
  const startOver = useEffectEvent(reset);
  useEffect(() => {
    if (!published) return;
    return () => startOver();
  }, [published]);

  const label = STEPS.find((s) => s.step === step)?.label;
  const finished = step === 4 && publish.phase >= DONE;

  return (
    // Working on a file: the panel becomes a screen-sized window (DESIGN §3.2) so the
    // step bar and Back / Continue stay visible; long content scrolls inside it.
    <section
      ref={panelRef}
      className={`pub-panel pixel-panel${ready && draft.content ? " is-working" : ""}${finished ? " is-finished" : ""}`}
      aria-label="Publish a guideline"
    >
      <StepBar current={step} reachable={reachable} onSelect={go} finished={finished} />

      {!ready ? null : (
        <>
          <h2 className="sr-only">
            Step {step} of 4: {label}
          </h2>
          <div className={`pub-body step-${step}`}>
            {step === 1 && <StepFile draft={draft} update={update} />}
            {step === 2 && <StepCleanup draft={draft} update={update} scan={scan} />}
            {step === 3 && <StepDetails draft={draft} update={update} takenSlugs={takenSlugs} />}
            {step === 4 && (
              <StepPublish draft={draft} scan={scan} onReset={reset} publish={publish} />
            )}
          </div>

          {/* Step 1 with no file yet, and the finished publish, have their own calls to action */}
          {!(step === 1 && !draft.content) && !finished && (
            <footer className="pub-nav">
              {step > 1 ? (
                <button type="button" className="btn-ghost" disabled={busy || !!publish.pendingTx} onClick={() => go((step - 1) as Step)}>
                  ← Back
                </button>
              ) : (
                <button type="button" className="pub-link" onClick={reset}>
                  Discard draft
                </button>
              )}
              {step < 4 ? (
                <div className="pub-nav-next">
                  {problem && <span className="pub-nav-why">{problem}</span>}
                  <button type="button" className="btn-gold" disabled={!!problem} onClick={() => go((step + 1) as Step)}>
                    Continue →
                  </button>
                </div>
              ) : (
                <div className="pub-nav-next">
                  {/* K20: say it's permanent right before publishing (a notice, no checkbox) */}
                  <span className="pub-permanent">Published guidelines are stored on IPFS and Arc, so treat them as permanent</span>
                  <button type="button" className="btn-gold" disabled={busy} aria-busy={busy || undefined} onClick={() => void publish.start()}>
                    {busy ? "Publishing…" : publish.pendingTx ? "Finish publishing" : publish.error ? "Try again" : "Publish"}
                  </button>
                </div>
              )}
            </footer>
          )}
        </>
      )}
    </section>
  );
}
