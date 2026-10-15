import type { Metadata } from "next";
import CollectionPanel from "@/components/CollectionPanel";
import PageTransition from "@/components/PageTransition";
import { listGuidelineCards } from "@/lib/data/guidelines";

export const metadata: Metadata = {
  title: "My Collection · PikaMd",
  description: "Every guideline you've collected, in one place. Connect your agent once and it can read them all over MCP.",
};

// My Collection: hero in the same layout as Home and Explore, then the saved guidelines.
export default async function CollectionPage() {
  const guidelines = await listGuidelineCards();

  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high">
          <h1 className="hero-title">
            Your agent&apos;s
            <br />
            <span>personal library</span>
          </h1>
          <p className="hero-sub">
            <span>Every guideline you&apos;ve collected, in one place</span>{" "}
            <span>Connect your agent once and it can read them all over MCP</span>
          </p>
          <CollectionPanel guidelines={guidelines} />
        </div>
      </main>
    </PageTransition>
  );
}
