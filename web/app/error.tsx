"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import PageLink from "@/components/PageLink";
import StatusPanel from "@/components/StatusPanel";

// Shown when a page fails to render (e.g. the database doesn't answer), instead of the framework's
// bare error screen. The navbar and footer stay. In production the error's message isn't sent to
// the browser, only a digest that matches the server log.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPanel code="Oops" title="Something went wrong" description="PikaMd couldn't load this page right now. Try again in a moment">
      <button type="button" className="btn-gold" onClick={() => retry()}>
        Try again
      </button>
      <PageLink href="/" className="btn-ghost">
        Home
      </PageLink>
    </StatusPanel>
  );
}
