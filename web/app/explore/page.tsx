import type { Metadata } from "next";
import ExploreLibrary from "@/components/ExploreLibrary";
import PageTransition from "@/components/PageTransition";
import { listGuidelineCards } from "@/lib/data/guidelines";

export const metadata: Metadata = {
  title: "Explore · PikaMd",
  description: "Browse guidelines shared by the community and add the ones you like to your collection. Your agent can use them over MCP.",
};

// The whole page is prerendered, cards included, so a navigation shows them at once; the browser
// then refreshes the list (lib/data/guidelines.ts: Freshness).
export default async function ExplorePage() {
  const guidelines = await listGuidelineCards();

  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high hero-compact explore-hero">
          <h1 className="hero-title">
            Give your agent
            <br />
            <span>a creative edge</span>
          </h1>
          <p className="hero-sub">
            <span>Browse guidelines shared by the community</span>{" "}
            <span>Add the ones you like to your collection and your agent can use them over MCP</span>
          </p>
          <ExploreLibrary initial={guidelines} />
        </div>
      </main>
    </PageTransition>
  );
}
