import type { Metadata } from "next";
import PageTransition from "@/components/PageTransition";
import ModPanel from "@/components/mod/ModPanel";

export const metadata: Metadata = {
  title: "Moderation · PikaMd",
  description: "Reports, flagged files and locked guidelines, for PikaMd moderators.",
  robots: { index: false, follow: false },
};

// For wallets holding MODERATOR_ROLE in GuidelineRegistry (checked on Arc by the server).
export default function ModerationPage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high hero-compact">
          <h1 className="hero-title">
            Keep the library
            <br />
            <span>safe for every agent</span>
          </h1>
          <p className="hero-sub">
            <span>Reports, files the scan flagged and locked guidelines</span>
            <span>Locks are written to Arc from your moderator wallet</span>
          </p>
          <ModPanel />
        </div>
      </main>
    </PageTransition>
  );
}
