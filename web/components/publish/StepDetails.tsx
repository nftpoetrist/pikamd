"use client";

import { useState } from "react";
import MdCard from "@/components/MdCard";
import type { Draft } from "@/lib/publish/draft";
import { KIND_INFO, slugify } from "@/lib/publish/templates";
import { SUMMARY_MAX, SUMMARY_MIN, TAGS_MAX, TAG_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/publish/validate";
import { scanGuideline } from "@/lib/scan";
import type { Guideline, GuidelineKind } from "@/lib/types";

type Props = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  takenSlugs: string[];
};

// Limits shared with the server check (lib/publish/validate.ts), so both always agree
export const SUMMARY_IDEAL = 80; // three lines on an Explore card

const KINDS = Object.keys(KIND_INFO) as GuidelineKind[];

/** The card text goes public too: it gets the same scan as the file. */
export function metaLeak(meta: Draft["meta"], privateTerms: string[]) {
  const text = [meta.title, meta.description, meta.tags.join(" ")].join("\n");
  return scanGuideline(text, privateTerms).findings.find((f) => f.severity === "block" || f.severity === "personal");
}

/** Details are complete when the card has a title and a summary, and neither leaks anything. */
export function detailsProblem(meta: Draft["meta"], takenSlugs: string[], privateTerms: string[]): string | null {
  if (meta.title.trim().length < TITLE_MIN) return `Give it a title (at least ${TITLE_MIN} characters).`;
  if (meta.description.trim().length < SUMMARY_MIN) return "Write a one-line summary of what it does.";
  if (takenSlugs.includes(slugify(meta.title))) return "That title is already taken. Try a more specific one.";
  if (metaLeak(meta, privateTerms)) return "Remove the private info from the card text.";
  return null;
}

const cleanTag = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TAG_MAX);

// Step 3: what goes on the card, with the Explore card rendered live next to the form.
// No license picker: every guideline is shared under one license (see lib/publish/draft.ts).
export default function StepDetails({ draft, update, takenSlugs }: Props) {
  const { meta } = draft;
  const [tagInput, setTagInput] = useState("");
  const setMeta = (patch: Partial<Draft["meta"]>) => update({ meta: { ...meta, ...patch } });
  const slug = slugify(meta.title) || "untitled";
  const taken = takenSlugs.includes(slug);

  const addTags = (raw: string) => {
    const next = [...meta.tags];
    for (const t of raw.split(/[,\s]+/).map(cleanTag)) {
      if (t.length >= 2 && !next.includes(t) && next.length < TAGS_MAX) next.push(t);
    }
    setMeta({ tags: next });
    setTagInput("");
  };

  const card: Guideline = {
    id: 0,
    slug,
    title: meta.title || "Your guideline",
    description: meta.description || "One line on what it does for an agent.",
    kind: meta.kind,
    tags: meta.tags.length ? meta.tags : ["tag"],
    author: { address: "0x0000000000000000000000000000000000000000", handle: "you" },
    license: meta.license,
    latestVersion: 1,
    stars: 0,
    uses: 0,
    content: draft.content,
  };

  const leak = metaLeak(meta, draft.privateTerms);

  return (
    <div className="pub-details">
      <div className="pub-form">
        {leak && (
          <p className="pub-error" role="alert">
            The card text contains {leak.message.toLowerCase()}: <code>{leak.severity === "block" ? "••••••" : leak.match}</code>. It
            goes public with the file, so remove it.
          </p>
        )}
        <div className="pub-field">
          <label htmlFor="pub-title">Title</label>
          <input
            id="pub-title"
            className="pub-input"
            value={meta.title}
            maxLength={TITLE_MAX}
            placeholder="e.g. Secure Solidity"
            onChange={(e) => setMeta({ title: e.target.value })}
          />
          <p className={taken ? "pub-hint is-error" : "pub-hint"}>
            File name: <code>{slug}.md</code>
            {taken && " is already taken"}
          </p>
        </div>

        <div className="pub-field">
          <label htmlFor="pub-summary">Summary</label>
          <textarea
            id="pub-summary"
            className="pub-input pub-input-area"
            value={meta.description}
            maxLength={SUMMARY_MAX}
            rows={2}
            placeholder="e.g. Teaches your agent to write and review Solidity contracts safely"
            onChange={(e) => setMeta({ description: e.target.value.replace(/\n/g, " ") })}
          />
          <p className={meta.description.length > SUMMARY_IDEAL ? "pub-hint is-warn" : "pub-hint"}>
            Say what it does for an agent. {meta.description.length}/{SUMMARY_IDEAL}
            {meta.description.length > SUMMARY_IDEAL && " (may not fit on the card)"}
          </p>
        </div>

        <fieldset className="pub-field">
          <legend>Type</legend>
          <div className="pub-kinds">
            {KINDS.map((k) => (
              <label key={k} className={meta.kind === k ? "pub-kind is-on" : "pub-kind"}>
                <input type="radio" name="kind" className="sr-only" checked={meta.kind === k} onChange={() => setMeta({ kind: k })} />
                <span className="md-badge">{KIND_INFO[k].label.toUpperCase()}</span>
                <span className="pub-kind-hint">{KIND_INFO[k].hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pub-field">
          <label htmlFor="pub-tags">Tags</label>
          <div className="scan-terms-row">
            <input
              id="pub-tags"
              className="pub-input"
              value={tagInput}
              disabled={meta.tags.length >= TAGS_MAX}
              placeholder={meta.tags.length >= TAGS_MAX ? "Up to 5 tags" : "e.g. solidity, security"}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTags(tagInput);
                }
              }}
              onBlur={() => tagInput && addTags(tagInput)}
            />
          </div>
          {meta.tags.length > 0 && (
            <ul className="pub-chips">
              {meta.tags.map((t) => (
                <li key={t}>
                  {t}
                  <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setMeta({ tags: meta.tags.filter((x) => x !== t) })}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="pub-hint">Optional, up to 5. They help people find it.</p>
        </div>

      </div>

      <aside className="pub-cardpreview" aria-label="How it will look on Explore">
        <p className="pub-cardpreview-label">How it will look on Explore</p>
        {/* A picture of the card: its buttons do nothing here */}
        <div inert>
          <MdCard guideline={card} />
        </div>
      </aside>
    </div>
  );
}
