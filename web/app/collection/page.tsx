import CollectionPanel from "@/components/CollectionPanel";
import PageTransition from "@/components/PageTransition";
import { listGuidelines } from "@/lib/data/guidelines";

// My Collection: hero in the same layout as Home and Explore, then the saved guidelines.
export default async function CollectionPage() {
  const guidelines = await listGuidelines();

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
