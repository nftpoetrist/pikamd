"use client";

import { Suspense } from "react";
import ExploreEmpty from "@/components/ExploreEmpty";
import MdLanes from "@/components/MdLanes";
import ExploreSearch, { SearchBoxShell } from "@/components/search/ExploreSearch";
import { useLibrary } from "@/lib/library/client";
import type { GuidelineCard } from "@/lib/types";

const TOP_TAGS = 8;

/** Most used tags first (ties alphabetical), for the search filter buttons. */
function topTags(guidelines: GuidelineCard[]): string[] {
  const counts = new Map<string, number>();
  for (const g of guidelines) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_TAGS)
    .map(([t]) => t);
}

// Explore's search and lanes: the cards from the page's shell show at once, then the current
// library replaces them in place (lib/library/client.ts).
export default function ExploreLibrary({ initial }: { initial: GuidelineCard[] }) {
  const guidelines = useLibrary(initial);
  if (guidelines.length === 0) return <ExploreEmpty />;
  return (
    <>
      {/* Reads ?q= on the client: Suspense keeps the rest of the page prerendered */}
      <Suspense fallback={<SearchBoxShell />}>
        <ExploreSearch topTags={topTags(guidelines)} />
      </Suspense>
      <MdLanes guidelines={guidelines} />
    </>
  );
}
