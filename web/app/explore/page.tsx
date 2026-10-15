import type { Metadata } from "next";
import { Suspense } from "react";
import MdLanes from "@/components/MdLanes";
import PageTransition from "@/components/PageTransition";
import ExploreSearch, { SearchBoxShell } from "@/components/search/ExploreSearch";
import { listGuidelineCards } from "@/lib/data/guidelines";
import type { GuidelineCard } from "@/lib/types";

export const metadata: Metadata = {
  title: "Explore · PikaMd",
  description: "Browse guidelines shared by the community and add the ones you like to your collection. Your agent can use them over MCP.",
};

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

export default async function ExplorePage() {
  const guidelines = await listGuidelineCards();

  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high explore-hero">
          <h1 className="hero-title">
            Give your agent
            <br />
            <span>a creative edge</span>
          </h1>
          <p className="hero-sub">
            <span>Browse guidelines shared by the community</span>{" "}
            <span>Add the ones you like to your collection and your agent can use them over MCP</span>
          </p>
          {/* Reads ?q= on the client: Suspense keeps the rest of the page prerendered */}
          <Suspense fallback={<SearchBoxShell />}>
            <ExploreSearch topTags={topTags(guidelines)} />
          </Suspense>
          <MdLanes guidelines={guidelines} />
        </div>
      </main>
    </PageTransition>
  );
}
