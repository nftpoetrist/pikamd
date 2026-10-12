// The JSON shape of /api/search, shared by the route and the search bar.
// Hits carry what the dropdown shows (no full file content: the preview loads that on demand).
import type { Author, GuidelineKind } from "@/lib/types";
import type { SearchOutcome } from "./engine.ts";
import type { Range } from "./text.ts";

export type SearchResultItem = {
  slug: string;
  title: string;
  description: string;
  kind: GuidelineKind;
  tags: string[];
  author: Author;
  stars: number;
  latestVersion: number;
  exact: boolean;
  titleRanges: Range[];
  descriptionRanges: Range[];
  lines: { line: number; text: string; ranges: Range[] }[];
};

export type SearchResponse = { total: number; warnings: string[]; hits: SearchResultItem[] };

export function toSearchResponse(outcome: SearchOutcome): SearchResponse {
  return {
    total: outcome.total,
    warnings: outcome.warnings,
    hits: outcome.hits.map(({ guideline: g, exact, title, description, lines }) => ({
      slug: g.slug,
      title: g.title,
      description: g.description,
      kind: g.kind,
      tags: g.tags,
      author: g.author,
      stars: g.stars,
      latestVersion: g.latestVersion,
      exact,
      titleRanges: title,
      descriptionRanges: description,
      lines,
    })),
  };
}
