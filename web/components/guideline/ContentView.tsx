"use client";

import { useId, useState } from "react";
import MarkdownPreview from "@/components/publish/MarkdownPreview";

// The file itself: rendered for reading, or the Markdown source exactly as the agent gets it.
export default function ContentView({ content }: { content: string }) {
  const [view, setView] = useState<"rendered" | "source">("rendered");
  const id = useId();
  const lines = content.split("\n");
  return (
    <section className="gl-content" aria-label="Guideline file">
      <div className="gl-view-tabs" role="tablist" aria-label="View">
        {(["rendered", "source"] as const).map((v) => (
          <button
            key={v}
            id={`${id}-${v}`}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-controls={`${id}-panel`}
            className={view === v ? "is-on" : ""}
            onClick={() => setView(v)}
          >
            {v === "rendered" ? "Rendered" : "Markdown"}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}`} className="gl-content-body">
        {view === "rendered" ? (
          <MarkdownPreview content={content} />
        ) : (
          <pre className="gl-source">
            {lines.map((line, i) => (
              <span key={i} className="gl-source-line">
                <span className="gl-source-n" aria-hidden="true">
                  {i + 1}
                </span>
                {line || " "}
              </span>
            ))}
          </pre>
        )}
      </div>
    </section>
  );
}
