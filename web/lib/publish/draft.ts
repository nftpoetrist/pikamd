import type { GuidelineKind, License } from "@/lib/types";

// The Publish draft lives in memory only: every visit starts a new guideline (2026-10-26, user
// request). Earlier versions kept it in this browser under this key; clearDraft removes that copy.
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
  /** Register transaction sent but not confirmed yet: a retry only confirms it. */
  publishTx?: `0x${string}`;
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

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
