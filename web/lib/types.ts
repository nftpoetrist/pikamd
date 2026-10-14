// Domain types. Shapes follow ARCHITECTURE.md §10 (Supabase index) so the mock
// data layer can be swapped for the real one without touching the UI.

// Accepted content types (ARCHITECTURE.md K20): a single plain-text .md file.
export type GuidelineKind = "rules" | "skill" | "prompt" | "agent" | "guide";

export type License = "CC-BY-4.0" | "CC0-1.0";

export interface Author {
  address: `0x${string}`;
  handle?: string;
}

export interface Guideline {
  id: number; // on-chain id (GuidelineRegistry)
  slug: string;
  title: string;
  description: string;
  kind: GuidelineKind;
  tags: string[];
  author: Author;
  license: License;
  latestVersion: number;
  stars: number;
  uses: number;
  /** Markdown of the latest version. */
  content: string;
  /** The scan flagged lines a moderator hasn't checked yet: shown on the site, never served over MCP. */
  flagged?: boolean;
}
