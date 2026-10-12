import type { Metadata } from "next";
import PageTransition from "@/components/PageTransition";
import PublishFlow from "@/components/publish/PublishFlow";
import { listGuidelines } from "@/lib/data/guidelines";

export const metadata: Metadata = {
  title: "Publish · PikaMd",
  description: "Contribute to the community by sharing your guidelines. Earn tips, collect likes and get PikaGold.",
};

// Publish: hero + the four-step flow (File → Clean up → Details → Publish).
export default async function NewPage() {
  const takenSlugs = (await listGuidelines()).map((g) => g.slug);

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
          <PublishFlow takenSlugs={takenSlugs} />
        </div>
      </main>
    </PageTransition>
  );
}
