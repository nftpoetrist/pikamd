"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { navDirection } from "@/lib/nav-direction";

// The page transition reads the direction from <html data-nav> (globals.css, PAGE TRANSITIONS).
// Not React transition types (next/link transitionTypes): when a navigation preempts a background
// router refresh, Next commits the new page in a transition of its own and the types are lost.
// Browser back/forward has no direction, so the attribute goes and the page cross-fades.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => delete document.documentElement.dataset.nav);
}

/**
 * next/link that tells the page transition which way to slide (lib/nav-direction.ts). A link to the
 * page you're already on (same path and query, no #section) glides back to the top instead of
 * navigating again: the navbar logo on the home page, "Explore" on Explore… (user request 2026-10-26).
 */
export default function PageLink({ onClick, href, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(e) => {
        const target = new URL(typeof href === "string" ? href : (href.pathname ?? "/"), location.href);
        const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        if (!newTab && !target.hash && target.pathname === location.pathname && target.search === location.search) {
          e.preventDefault(); // next/link skips the navigation (app-dir/link.js: defaultPrevented)
          const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: 0, behavior: still ? "instant" : "smooth" });
          onClick?.(e); // e.g. the phone menu still closes
          return;
        }
        const to = target.pathname;
        const direction = navDirection(location.pathname, to);
        if (direction) document.documentElement.dataset.nav = direction;
        else delete document.documentElement.dataset.nav;
        onClick?.(e);
      }}
    />
  );
}
