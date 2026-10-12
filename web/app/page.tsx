import PageTransition from "@/components/PageTransition";
import VisionCards from "@/components/VisionCards";
import VisionPanel from "@/components/VisionPanel";

// Home: the vision. The guideline lanes live on /explore.
export default function HomePage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high">
          <h1 className="hero-title">
            Built by the community
            <br />
            <span>for the community</span>
          </h1>
          <p className="hero-sub">
            <span>Share your guidelines with the community and build on the best of what others have shared</span>{" "}
            <span>The decentralized guideline platform for getting the most out of your AI agents</span>
          </p>
          <VisionCards />
          <VisionPanel />
        </div>
      </main>
    </PageTransition>
  );
}
