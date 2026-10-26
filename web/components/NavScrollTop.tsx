"use client";

import { usePathname } from "next/navigation";
import { Suspense, useLayoutEffect, useRef } from "react";

// Every page opens at its top after a link (user request 2026-10-26). Next keeps visited pages
// hidden with their scroll position, so a page left halfway used to come back halfway. A layout
// effect runs in the navigation's commit, before the page transition snapshots the new page, so
// the slide already shows its top. The browser's back and forward keep their usual restore, and a
// link to a #section lands on that section.
let fromHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    fromHistory = true;
  });
}

function ScrollTop() {
  const pathname = usePathname();
  const last = useRef(pathname);
  useLayoutEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const history = fromHistory;
    fromHistory = false;
    if (history || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

// The path is runtime data on dynamic routes (/g/[slug]): read inside Suspense, like the navbar
export default function NavScrollTop() {
  return (
    <Suspense fallback={null}>
      <ScrollTop />
    </Suspense>
  );
}
