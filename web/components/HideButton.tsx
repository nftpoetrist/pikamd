"use client";

import { useEffect } from "react";
import { VISIBILITY_PHASES, useVisibility } from "@/lib/owned/client";

// The author's own Hide / Show button (GuidelineRegistry.setHidden from their wallet). It takes the
// Tip button's place on their own guidelines (components/AuthorAction.tsx). Red Hide, gold Show;
// while it works and when it fails, the balloon above it says what's happening.
export default function HideButton({ id, title, hidden = false, focusable = true }: { id: number; title: string; hidden?: boolean; focusable?: boolean }) {
  const { phase, busy, error, pendingTx, run, clearError } = useVisibility();
  const action = hidden ? "Show again" : "Hide";
  const label = busy ? "…" : pendingTx ? "Retry" : hidden ? "Show" : "Hide";
  const failed = !busy && !!error;
  const note = busy ? VISIBILITY_PHASES[phase] : error ? `${error}${pendingTx ? ". Your change is on Arc: press Retry to update PikaMd" : ""}` : null;

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clearError, 6000);
    return () => window.clearTimeout(t);
  }, [error, clearError]);

  return (
    <span className="md-tip-wrap">
      <button
        type="button"
        className={hidden ? "md-tip md-show" : "md-tip md-hide"}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label={`${pendingTx && !busy ? "Finish: " : ""}${action} ${title}`}
        title={hidden ? "Show it again on Explore, search and MCP" : "Hide it from Explore, search and MCP"}
        tabIndex={focusable ? undefined : -1}
        onClick={() => void run(id, !hidden)}
      >
        {label}
      </button>
      {note && (
        <span className={failed ? "md-tip-note is-error" : "md-tip-note"} role={failed ? "alert" : "status"}>
          {note}
        </span>
      )}
    </span>
  );
}
