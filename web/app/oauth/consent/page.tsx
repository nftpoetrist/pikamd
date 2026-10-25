import type { Metadata } from "next";
import { Suspense } from "react";
import PageTransition from "@/components/PageTransition";
import ConsentPanel from "@/components/oauth/ConsentPanel";

export const metadata: Metadata = {
  title: "Connect an app · PikaMd",
  description: "Allow an app to read your PikaMd collection.",
  robots: { index: false, follow: false },
};

// The consent screen of PikaMd's OAuth sign-in for agents (ARCHITECTURE §8.2). /oauth/authorize
// checks the request and sends the browser here with its id; the panel does the rest.
export default function ConsentPage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center">
          <Suspense fallback={<section className="consent pixel-panel" aria-busy="true" style={{ minHeight: 420 }} />}>
            <ConsentPanel />
          </Suspense>
        </div>
      </main>
    </PageTransition>
  );
}
