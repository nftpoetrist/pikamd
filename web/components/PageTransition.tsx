import { ViewTransition } from "react";

// Wraps each page.tsx's content. Not placed in the layout: layouts persist across
// navigations, so enter/exit never fire there (Next docs: guides/view-transitions).
// Which way the pages slide comes from <html data-nav>, set by components/PageLink.tsx.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
