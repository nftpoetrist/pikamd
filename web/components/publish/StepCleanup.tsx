"use client";

import { useMemo, useState, type ReactNode } from "react";
import { keepKey, type Draft } from "@/lib/publish/draft";
import { replaceFindings, type Finding, type ScanResult, type Severity } from "@/lib/scan";

type Props = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  scan: ScanResult;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Same rule + same text = one decision, wherever it appears.
type Group = {
  key: string;
  rule: string;
  severity: Severity;
  match: string;
  message: string;
  placeholder?: string;
  lines: number[];
  findings: Finding[];
  kept: boolean;
};

const SECTIONS: { severity: Severity; title: string; note: string }[] = [
  { severity: "block", title: "Secrets", note: "Must be removed. Publishing stays locked until they are gone." },
  { severity: "personal", title: "Personal data", note: "Replace it with a placeholder, or keep it if it's meant to be public." },
  { severity: "review", title: "Needs review", note: "Looks like an instruction that could harm someone's agent. Remove it, or keep it and a moderator will review it before agents can fetch it." },
  { severity: "info", title: "Links", note: "For your information. Make sure each one is meant to be public." },
];

// Secrets are never shown in full, not even back to their author.
function shown(g: Pick<Group, "severity" | "match">) {
  const m = g.match.replace(/\s+/g, " ");
  if (g.severity === "block") return m.length <= 8 ? "••••••" : `${m.slice(0, 6)}••••••${m.slice(-2)}`;
  return m.length > 60 ? `${m.slice(0, 57)}…` : m;
}

function groupFindings(findings: Finding[], kept: Set<string>): Group[] {
  const map = new Map<string, Group>();
  for (const f of findings) {
    const key = keepKey(f.rule, f.match);
    const g = map.get(key);
    if (g) {
      g.findings.push(f);
      if (!g.lines.includes(f.line)) g.lines.push(f.line);
    } else {
      map.set(key, { key, rule: f.rule, severity: f.severity, match: f.match, message: f.message, placeholder: f.placeholder, lines: [f.line], findings: [f], kept: kept.has(key) });
    }
  }
  return [...map.values()];
}

/** How many decisions are still open; Clean up is done when this is 0. */
export function openCount(scan: ScanResult, kept: string[]) {
  const set = new Set(kept);
  return scan.findings.filter((f) => f.severity === "block" || ((f.severity === "personal" || f.severity === "review") && !set.has(keepKey(f.rule, f.match)))).length;
}

// The file with each finding highlighted in place, line numbers on the left.
function FileView({ content, findings, kept, flash }: { content: string; findings: Finding[]; kept: Set<string>; flash: number | null }) {
  const lines = useMemo(() => {
    const out: { start: number; text: string }[] = [];
    let start = 0;
    for (const text of content.split("\n")) {
      out.push({ start, text });
      start += text.length + 1;
    }
    return out;
  }, [content]);

  // Findings per line, clipped to the line (a key block can span several lines).
  const byLine = useMemo(() => {
    const map = new Map<number, Finding[]>();
    for (const f of findings) {
      for (let i = f.line - 1; i < lines.length && lines[i].start < f.end; i++) {
        map.set(i, [...(map.get(i) ?? []), f]);
      }
    }
    return map;
  }, [findings, lines]);

  return (
    <div className="scan-file" aria-label="Your file with findings highlighted">
      {lines.map(({ start, text }, i) => {
        const all = byLine.get(i) ?? [];
        // A risky line can also hold personal data. Then the line gets an orange stripe and
        // only the data is marked inline, so no text is drawn twice.
        const isOverlapped = (f: Finding) => all.some((o) => o !== f && o.severity !== "review" && o.start < f.end && o.end > f.start);
        const marks = all.filter((f) => f.severity !== "review" || !isOverlapped(f)).sort((a, b) => a.start - b.start);
        const risky = all.some((f) => f.severity === "review");
        let body: ReactNode = text || " ";
        if (marks.length) {
          const parts: ReactNode[] = [];
          let pos = 0;
          for (const f of marks) {
            const s = Math.max(f.start - start, pos);
            const e = Math.min(f.end - start, text.length);
            if (e <= s) continue;
            if (s > pos) parts.push(text.slice(pos, s));
            const isKept = kept.has(keepKey(f.rule, f.match));
            parts.push(
              <mark key={f.id} className={`scan-mark sev-${f.severity}${isKept ? " is-kept" : ""}`}>
                {f.severity === "block" ? "•".repeat(Math.min(e - s, 24)) : text.slice(s, e)}
              </mark>,
            );
            pos = Math.max(pos, e);
          }
          if (pos < text.length) parts.push(text.slice(pos));
          body = parts;
        }
        return (
          <div
            key={i}
            id={`scan-line-${i + 1}`}
            className={["scan-line", all.length && "has-mark", risky && "has-review", flash === i + 1 && "is-flash"].filter(Boolean).join(" ")}
          >
            <span className="scan-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="scan-text">{body}</span>
          </div>
        );
      })}
    </div>
  );
}

// Step 2: find personal data, secrets and risky instructions; the author decides each one.
export default function StepCleanup({ draft, update, scan }: Props) {
  const [term, setTerm] = useState("");
  const [flash, setFlash] = useState<number | null>(null);
  const kept = useMemo(() => new Set(draft.kept), [draft.kept]);
  const groups = useMemo(() => groupFindings(scan.findings, kept), [scan.findings, kept]);
  const open = openCount(scan, draft.kept);

  // Only the flagged spans change; the same text inside another finding is left to that finding.
  const replace = (g: Group, withText: string) => {
    update({ content: replaceFindings(draft.content, g.findings, withText), replaced: draft.replaced + g.findings.length, kept: draft.kept.filter((k) => k !== g.key) });
  };
  const keep = (g: Group) => update({ kept: [...draft.kept, g.key] });
  const unkeep = (g: Group) => update({ kept: draft.kept.filter((k) => k !== g.key) });

  const jump = (line: number) => {
    document.getElementById(`scan-line-${line}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(line);
    window.setTimeout(() => setFlash(null), 900);
  };

  const addTerm = () => {
    const t = term.trim();
    if (t.length >= 2 && !draft.privateTerms.some((x) => x.toLowerCase() === t.toLowerCase())) {
      update({ privateTerms: [...draft.privateTerms, t] });
    }
    setTerm("");
  };

  return (
    <div className="scan">
      <div className={open === 0 ? "scan-summary is-clean" : "scan-summary"} role="status">
        {open === 0 ? (
          <p className="scan-summary-title">✓ Ready to continue</p>
        ) : (
          <p className="scan-summary-title">
            {open} {open === 1 ? "item needs" : "items need"} your decision
          </p>
        )}
        <ul className="scan-counts">
          <li className="sev-block">{plural(scan.counts.block, "secret")}</li>
          <li className="sev-personal">{scan.counts.personal} personal</li>
          <li className="sev-review">{scan.counts.review} to review</li>
          <li className="sev-info">{plural(scan.counts.info, "link")}</li>
        </ul>
        {draft.invisibleRemoved > 0 && (
          <p className="scan-summary-note">Removed {plural(draft.invisibleRemoved, "invisible character")} that could hide or reorder text.</p>
        )}
        <p className="scan-summary-note">
          Automatic checks catch common patterns, not everything. Read your file once more before you publish.
        </p>
      </div>

      <div className="scan-body">
        <div className="scan-side">
          <form
            className="scan-terms"
            onSubmit={(e) => {
              e.preventDefault();
              addTerm();
            }}
          >
            <label htmlFor="private-term" className="scan-terms-label">
              Anything else private? Project or company names
            </label>
            <div className="scan-terms-row">
              <input id="private-term" className="pub-input" value={term} placeholder="e.g. acme" onChange={(e) => setTerm(e.target.value)} />
              <button type="submit" className="btn-ghost">
                Add
              </button>
            </div>
            {draft.privateTerms.length > 0 && (
              <ul className="pub-chips">
                {draft.privateTerms.map((t) => (
                  <li key={t}>
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => update({ privateTerms: draft.privateTerms.filter((x) => x !== t) })}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {SECTIONS.map(({ severity, title, note }) => {
            const items = groups.filter((g) => g.severity === severity);
            if (items.length === 0) return null;
            return (
              <section key={severity} className={`scan-section sev-${severity}`} aria-label={title}>
                <h3 className="scan-section-title">
                  {title} <span>{items.length}</span>
                </h3>
                <p className="scan-section-note">{note}</p>
                <ul className="scan-list">
                  {items.map((g) => (
                    <li key={g.key} className={g.kept ? "scan-item is-kept" : "scan-item"}>
                      <button type="button" className="scan-item-where" onClick={() => jump(g.lines[0])}>
                        Line {g.lines.slice(0, 3).join(", ")}
                        {g.lines.length > 3 ? ` +${g.lines.length - 3}` : ""}
                      </button>
                      <p className="scan-item-msg">{g.message}</p>
                      <p className="scan-item-match">
                        <code>{shown(g)}</code>
                        {g.placeholder && severity !== "info" && (
                          <>
                            {" "}→ <code className="scan-ph">{g.placeholder}</code>
                          </>
                        )}
                      </p>
                      {severity !== "info" && (
                        <div className="scan-item-actions">
                          {g.kept ? (
                            <>
                              <span className="scan-kept-label">{severity === "review" ? "Kept: sent for review" : "Kept on purpose"}</span>
                              <button type="button" className="pub-link" onClick={() => unkeep(g)}>
                                Undo
                              </button>
                            </>
                          ) : (
                            <>
                              {g.placeholder ? (
                                <button type="button" className="pub-act is-primary" onClick={() => replace(g, g.placeholder!)}>
                                  {g.findings.length > 1 ? `Replace all (${g.findings.length})` : "Replace"}
                                </button>
                              ) : (
                                <button type="button" className="pub-act is-primary" onClick={() => replace(g, "")}>
                                  Remove
                                </button>
                              )}
                              {severity !== "block" && (
                                <button type="button" className="pub-act" onClick={() => keep(g)}>
                                  {severity === "review" ? "Keep for review" : "Keep anyway"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {scan.findings.length === 0 && <p className="scan-empty">Nothing personal or risky found. Nice and clean.</p>}
        </div>

        <FileView content={draft.content} findings={scan.findings} kept={kept} flash={flash} />
      </div>
    </div>
  );
}
