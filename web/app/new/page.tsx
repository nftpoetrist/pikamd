import type { Metadata } from "next";
import PageTransition from "@/components/PageTransition";
import PublishFlow from "@/components/publish/PublishFlow";
import { listGuidelineCards } from "@/lib/data/guidelines";

export const metadata: Metadata = {
  title: "Publish · PikaMd",
  description: "Contribute to the community by sharing your guidelines. Earn tips, collect likes and get PikaGold.",
};

// Publish: hero + the four-step flow (File → Clean up → Details → Publish). The whole page is
// prerendered; the browser then refreshes the names already taken (lib/data/guidelines.ts: Freshness).
export default async function NewPage() {
  const guidelines = await listGuidelineCards();

  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high">
          <h1 className="hero-title">
            Contribute to the community
            <br />
            <span>by sharing your guidelines</span>
          </h1>
          <p className="hero-sub">
            <span>Earn tips, collect likes and get PikaGold</span>
          </p>
          <PublishFlow guidelines={guidelines} />
        </div>
      </main>
    </PageTransition>
  );
}
