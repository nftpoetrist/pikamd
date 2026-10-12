"use client";

import { useDeferredValue, useRef, useState, type DragEvent } from "react";
import MarkdownPreview from "@/components/publish/MarkdownPreview";
import type { Draft } from "@/lib/publish/draft";
import { guessMeta, kindFromFileName } from "@/lib/publish/templates";
import { MAX_BYTES, WARN_BYTES, byteLength, checkFile, formatBytes, stripInvisible } from "@/lib/scan";

type Props = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
};

// How sharing works. The author's own agent makes the clean copy first; our rule-based
// filter is the second look (ARCHITECTURE §9.1.1). One sentence each, no closing period.
const HOW_TO: { title: string; text: string }[] = [
  { title: "Ask your agent for a clean copy", text: "Paste the prompt below into Claude Code, Cursor or any agent you use" },
  { title: "Upload the clean copy", text: "Drop the new .md file your agent made into the box above" },
  { title: "Check what we found", text: "Our filter looks again for paths, emails and keys your agent may have missed" },
  { title: "Describe and publish", text: "Add a title and a short summary, then publish it from your wallet" },
];

// Copied as-is into the author's agent. Plain English, tool-agnostic (K19).
export const CLEAN_COPY_PROMPT = `Make a copy of my CLAUDE.md that is safe to share publicly and save it as CLAUDE.shared.md.
- Remove personal data: names, emails, phone numbers, wallet addresses and user names in file paths.
- Remove private project details: company, client and project names, internal URLs and IP addresses.
- Remove every secret: API keys, tokens, passwords and private keys.
- Replace each one with a placeholder like {{EMAIL}}, {{PROJECT_PATH}} or {{API_KEY}}.
- Keep every rule and instruction. Don't change anything else.
- When you're done, list what you replaced.`;

const ROMAN = ["I", "II", "III", "IV"];

// Step 1: bring a file (drop, upload, template or blank), edit it, see it rendered.
export default function StepFile({ draft, update }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [copied, setCopied] = useState(false);
  // Rendering a long file on every keystroke would lag the editor.
  const preview = useDeferredValue(draft.content);

  const bytes = byteLength(draft.content);
  const tokens = Math.round(bytes / 4);

  const load = async (file: File) => {
    setError(null);
    const result = checkFile(file.name, new Uint8Array(await file.arrayBuffer()));
    if (result.problem || result.text === undefined) {
      setError(result.problem?.message ?? "This file can't be read.");
      return;
    }
    const { text, removed } = stripInvisible(result.text);
    const guess = guessMeta(text);
    update({
      content: text,
      fileName: file.name,
      invisibleRemoved: removed,
      kept: [],
      replaced: 0,
      // Title and summary are prefilled later, from the cleaned file (see PublishFlow).
      meta: { ...draft.meta, kind: kindFromFileName(file.name) ?? guess.kind ?? draft.meta.kind },
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void load(file);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CLEAN_COPY_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the prompt stays selectable on the page.
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".md,.markdown,text/markdown"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void load(file);
        e.target.value = "";
      }}
    />
  );

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  // Nothing yet: drop zone + templates.
  if (!draft.content) {
    return (
      <div className="pub-start">
        <div className={dragging ? "pub-drop is-dragging" : "pub-drop"} {...dropProps}>
          <p className="pub-drop-title">Drop your .md file here</p>
          <p className="pub-drop-text">One plain-text Markdown file, up to {formatBytes(MAX_BYTES)}</p>
          <button type="button" className="btn-gold" onClick={() => inputRef.current?.click()}>
            Choose a file
          </button>
          {fileInput}
        </div>
        {error && (
          <p className="pub-error" role="alert">
            {error}
          </p>
        )}

        <h3 className="pub-howto-title">How to share a guideline</h3>
        <ol className="pub-howto">
          {HOW_TO.map(({ title, text }, i) => (
            <li key={title} className="pub-howto-step">
              <span className="pub-howto-num" aria-hidden="true">
                {ROMAN[i]}
              </span>
              <span className="pub-howto-name">{title}</span>
              <span className="pub-howto-text">{text}</span>
            </li>
          ))}
        </ol>

        <div className="pub-prompt">
          <div className="pub-prompt-head">
            <p className="pub-prompt-title">Prompt for your agent</p>
            <button type="button" className={copied ? "btn-gold" : "btn-ghost"} onClick={copyPrompt} aria-live="polite">
              {copied ? "✓ Copied" : "Copy prompt"}
            </button>
          </div>
          <pre className="pub-prompt-text">{CLEAN_COPY_PROMPT}</pre>
          <p className="pub-hint">Change CLAUDE.md to the name of the file you want to share</p>
        </div>
        <button type="button" className="pub-link" onClick={() => update({ content: "# " })}>
          No file yet? Write one from scratch
        </button>
      </div>
    );
  }

  return (
    <div className={dragging ? "pub-editor is-dragging" : "pub-editor"} {...dropProps}>
      <div className="pub-editor-bar">
        <span className="md-file">{draft.fileName || "untitled.md"}</span>
        <span className={bytes > WARN_BYTES ? "pub-size is-long" : "pub-size"}>
          {formatBytes(bytes)} / {formatBytes(MAX_BYTES)}
        </span>
        <button type="button" className="pub-link" onClick={() => inputRef.current?.click()}>
          Replace file
        </button>
        {fileInput}
      </div>

      {bytes > MAX_BYTES && (
        <p className="pub-error" role="alert">
          This guideline is {formatBytes(bytes)}. The limit is {formatBytes(MAX_BYTES)}. Split it into smaller guidelines.
        </p>
      )}
      {bytes > WARN_BYTES && bytes <= MAX_BYTES && (
        <p className="pub-note">
          Long guideline (~{tokens.toLocaleString("en-US")} tokens). It will use a large part of your agent&apos;s context.
        </p>
      )}
      {error && (
        <p className="pub-error" role="alert">
          {error}
        </p>
      )}

      {/* Narrow screens show one pane at a time */}
      <div className="pub-tabs" role="tablist" aria-label="Editor view">
        <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
          Write
        </button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
          Preview
        </button>
      </div>

      <div className={`pub-panes show-${tab}`}>
        <label className="pub-pane pub-pane-write">
          <span className="sr-only">Markdown</span>
          <textarea
            className="pub-textarea"
            value={draft.content}
            spellCheck={false}
            onChange={(e) => update({ content: e.target.value })}
          />
        </label>
        <div className="pub-pane pub-pane-preview" aria-label="Preview">
          <MarkdownPreview content={preview} />
        </div>
      </div>
    </div>
  );
}
