// Server-side check of a guideline before it's pinned and registered (ARCHITECTURE §7.1, §9.1).
// The Publish steps in the browser apply the same rules, but those can be bypassed, so the
// server repeats them. Pure, so it runs in tests.
import { MAX_BYTES, byteLength, scanGuideline, stripInvisible, type ScanResult } from "../scan.ts";
import { slugify } from "./templates.ts";
import type { GuidelineKind } from "../types.ts";

export const TITLE_MIN = 3;
export const TITLE_MAX = 60;
export const SUMMARY_MIN = 10;
export const SUMMARY_MAX = 100;
export const TAGS_MAX = 5;
export const TAG_MAX = 20;
export const KINDS: readonly GuidelineKind[] = ["rules", "skill", "prompt", "agent", "guide"];
const TAG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/; // what the Details step produces (cleanTag)
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ScanStatus = "clean" | "warning" | "suspicious";

export type PublishInput = {
  content: string;
  meta: { title: string; description: string; kind: GuidelineKind; tags: string[] };
  slug: string;
  scanStatus: ScanStatus;
  /** Rules, severities and lines only: never the matched text. */
  scanReport: { counts: ScanResult["counts"]; findings: { rule: string; severity: string; line: number }[] };
};

/** The cleaned, checked submission, or why it's refused. */
export function validatePublish(body: unknown): PublishInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Send the file and its details" };
  const { content: raw, meta } = body as { content?: unknown; meta?: Record<string, unknown> };
  if (typeof raw !== "string" || !meta || typeof meta !== "object") return { error: "Send the file and its details" };

  // Invisible and direction-changing characters never get published (§9.1)
  const content = stripInvisible(raw).text;
  if (!content.trim() || content.trim() === "#") return { error: "The file is empty" };
  if (byteLength(content) > MAX_BYTES) return { error: "The file is over the 512 KB limit" };

  const title = typeof meta.title === "string" ? meta.title.trim() : "";
  const description = typeof meta.description === "string" ? meta.description.trim() : "";
  const kind = KINDS.find((k) => k === meta.kind);
  const tags = Array.isArray(meta.tags) ? meta.tags : null;
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) return { error: `The title needs ${TITLE_MIN}–${TITLE_MAX} characters` };
  if (description.length < SUMMARY_MIN || description.length > SUMMARY_MAX) return { error: `The summary needs ${SUMMARY_MIN}–${SUMMARY_MAX} characters` };
  if (!kind) return { error: "Choose a type" };
  if (!tags || tags.length > TAGS_MAX || tags.some((t) => typeof t !== "string" || t.length > TAG_MAX || !TAG_RE.test(t))) {
    return { error: `Up to ${TAGS_MAX} tags, each a-z, 0-9 and dashes` };
  }
  if (new Set(tags).size !== tags.length) return { error: "Each tag only once" };

  const slug = slugify(title);
  if (!slug || !SLUG_RE.test(slug)) return { error: "The title needs letters or digits" };

  // The card text is public too: no secrets and no personal data on it
  const card = scanGuideline([title, description, tags.join(" ")].join("\n"));
  if (card.findings.some((f) => f.severity === "block" || f.severity === "personal")) {
    return { error: "Remove the private info from the card text" };
  }

  // Secrets block publishing outright; personal data the author kept and flagged lines are recorded
  const scan = scanGuideline(content);
  if (scan.counts.block > 0) return { error: "The file still contains a secret (key, token or password). Go back to Clean up" };
  const scanStatus: ScanStatus = scan.counts.review > 0 ? "suspicious" : scan.counts.personal > 0 ? "warning" : "clean";

  return {
    content,
    meta: { title, description, kind, tags: tags as string[] },
    slug,
    scanStatus,
    scanReport: { counts: scan.counts, findings: scan.findings.map((f) => ({ rule: f.rule, severity: f.severity, line: f.line })) },
  };
}
