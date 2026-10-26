import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import PageTransition from "@/components/PageTransition";
import ModPanel from "@/components/mod/ModPanel";
import { sessionWallet } from "@/lib/server/auth";
import { isModerator } from "@/lib/server/moderation";

export const metadata: Metadata = {
  title: "Moderation · PikaMd",
  description: "Reports, flagged files, reviews and locks, for the PikaMd moderator.",
  robots: { index: false, follow: false },
};

// The moderation desk. proxy.ts already let only the site's moderator wallet through; here the
// server checks MODERATOR_ROLE on Arc too, before any of the page exists. Anyone else: the 404.
export default function ModerationPage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={null}>
          <Desk />
        </Suspense>
      </main>
    </PageTransition>
  );
}

async function Desk() {
  await connection(); // per request: the session is read and checked against the clock
  const wallet = await sessionWallet();
  let allowed: boolean;
  try {
    allowed = !!wallet && (await isModerator(wallet));
  } catch {
    // Only the moderator's own wallet gets this far (proxy.ts): say why instead of a blank 404
    return (
      <div className="page-center page-center-high hero-compact">
        <section className="mod-panel pixel-panel">
          <div className="collection-empty">
            <p className="collection-empty-title">Couldn&apos;t check your role on Arc</p>
            <p className="collection-empty-text">Arc didn&apos;t answer. Reload the page in a moment.</p>
          </div>
        </section>
      </div>
    );
  }
  if (!allowed) notFound();

  return (
    <div className="page-center page-center-high hero-compact">
      <h1 className="hero-title">
        Keep the library
        <br />
        <span>safe for every agent</span>
      </h1>
      <p className="hero-sub">
        <span>Reports, flagged files, reviews and locks</span>
        <span>Every decision is written to Arc from your moderator wallet</span>
      </p>
      <ModPanel />
    </div>
  );
}
