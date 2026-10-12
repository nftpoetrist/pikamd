import type { GuidelineKind, License } from "@/lib/types";

// Unsent Publish draft, kept in this browser so a reload doesn't lose the work.
// Per-viewer convenience only; nothing here is shared or sent anywhere.
const KEY = "pikamd:publish-draft";

export type Step = 1 | 2 | 3 | 4;

export interface Draft {
  step: Step;
  fileName: string;
  content: string;
  /** Words the author marked as private (project or company names). */
  privateTerms: string[];
  /** Findings the author chose to keep, as `${rule}␀${match}`. */
  kept: string[];
  /** How many placeholders the author applied in Clean up (for the summary). */
  replaced: number;
  /** Invisible characters removed from the file. */
  invisibleRemoved: number;
  meta: {
    title: string;
    description: string;
    kind: GuidelineKind;
    tags: string[];
    license: License;
  };
}

// One license for every guideline: credit stays with the author (K14). Not a choice in the UI.
export const LICENSE: License = "CC-BY-4.0";
export const LICENSE_TEXT = "CC BY 4.0: anyone can use and adapt it, with credit to you";

export const EMPTY_DRAFT: Draft = {
  step: 1,
  fileName: "",
  content: "",
  privateTerms: [],
  kept: [],
  replaced: 0,
  invisibleRemoved: 0,
  meta: { title: "", description: "", kind: "rules", tags: [], license: LICENSE },
};

export const keepKey = (rule: string, match: string) => `${rule}\u0000${match}`;

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (typeof d.content !== "string") return null;
    // Older drafts could carry another license from when it was a choice.
    return { ...EMPTY_DRAFT, ...d, meta: { ...EMPTY_DRAFT.meta, ...d.meta, license: LICENSE } };
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage full or blocked: the draft still lives in memory for this visit.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
