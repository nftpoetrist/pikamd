import HeroPlaque from "@/components/HeroPlaque";
import PageTransition from "@/components/PageTransition";
import VisionCards from "@/components/VisionCards";
import VisionPanel from "@/components/VisionPanel";

// Home: the vision. The guideline lanes live on /explore.
export default function HomePage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        {/* hero-compact: the smaller hero on short screens (as on Explore), so the plaque and the cards still fit the first screen */}
        <div className="page-center page-center-high hero-compact">
          <HeroPlaque>
            <h1 className="hero-title">
              Built by the community
              <br />
              <span>for the community</span>
            </h1>
            <p className="hero-sub">
              <span>Share your guidelines with the community and build on the best of what others have shared</span>{" "}
              <span>The decentralized guideline platform for getting the most out of your AI agents</span>
            </p>
          </HeroPlaque>
          <VisionCards />
          <VisionPanel />
        </div>
      </main>
    </PageTransition>
  );
}
