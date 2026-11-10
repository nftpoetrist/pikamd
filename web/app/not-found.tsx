import type { Metadata } from "next";
import PageLink from "@/components/PageLink";
import StatusPanel from "@/components/StatusPanel";

export const metadata: Metadata = {
  title: "Page not found · PikaMd",
};

export default function NotFound() {
  return (
    <StatusPanel code="404" title="Page not found" description="There's no page at this address. The guideline may have been hidden by its author, or the link has a typo">
      <PageLink href="/explore" className="btn-gold">
        Explore guidelines
      </PageLink>
      <PageLink href="/" className="btn-ghost">
        Home
      </PageLink>
    </StatusPanel>
  );
}
