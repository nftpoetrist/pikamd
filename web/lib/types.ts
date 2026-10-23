// Domain types. Shapes follow ARCHITECTURE.md §10 (Supabase index) so the mock
// data layer can be swapped for the real one without touching the UI.

// Accepted content types (ARCHITECTURE.md K20): a single plain-text .md file.
export type GuidelineKind = "rules" | "skill" | "prompt" | "agent" | "guide";

export type License = "CC-BY-4.0" | "CC0-1.0";

export interface Author {
  address: `0x${string}`;
  handle?: string;
}

/** What a card shows: everything but the file itself, which is loaded when a preview opens. */
export type GuidelineCard = Omit<Guideline, "content">;

/** One of the signed-in author's own guidelines ("Shared by me" on My Collection): hidden and locked ones too. */
export type OwnedGuideline = GuidelineCard & {
  /** The author hid it (GuidelineRegistry.setHidden): off Explore, search and MCP until shown again. */
  hidden: boolean;
  /** A moderator locked it: off the site whatever the author does. */
  locked: boolean;
};

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
  /**
   * A PikaMd moderator read this exact version and approved it on Arc (GuidelineReviews), and it
   * still holds: the "Reviewed" badge (ARCHITECTURE §9.5). From the index; the guideline's page
   * checks it on Arc itself.
   */
  reviewed?: boolean;
  /** Where the latest version is recorded: Arc transaction, IPFS CID and the sha256 the chain holds.
   * Absent for the sample data used in development. */
  record?: { txHash: `0x${string}`; cid: string; contentHash: `0x${string}` };
}
