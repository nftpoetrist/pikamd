import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import PageTransition from "@/components/PageTransition";
import PublishFlow, { PublishFlowShell } from "@/components/publish/PublishFlow";
import { listGuidelineCards } from "@/lib/data/guidelines";

export const metadata: Metadata = {
  title: "Publish · PikaMd",
  description: "Contribute to the community by sharing your guidelines. Earn tips, collect likes and get PikaGold.",
};

// Publish: hero + the four-step flow (File → Clean up → Details → Publish). The hero is
// prerendered; the names already taken are read at request time (lib/data/guidelines.ts: Freshness).
export default function NewPage() {
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
          <Suspense fallback={<PublishFlowShell />}>
            <Flow />
          </Suspense>
        </div>
      </main>
    </PageTransition>
  );
}

async function Flow() {
  await connection(); // never read at build time: the list is per request
  return <PublishFlow takenSlugs={(await listGuidelineCards()).map((g) => g.slug)} />;
}
