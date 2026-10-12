import MdLanes from "@/components/MdLanes";
import PageTransition from "@/components/PageTransition";
import { listGuidelines } from "@/lib/data/guidelines";

export default async function ExplorePage() {
  const guidelines = await listGuidelines();

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
          <MdLanes guidelines={guidelines} />
        </div>
      </main>
    </PageTransition>
  );
}
