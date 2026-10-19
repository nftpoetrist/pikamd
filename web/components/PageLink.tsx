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

/** next/link that tells the page transition which way to slide (lib/nav-direction.ts). */
export default function PageLink({ onClick, href, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(e) => {
        const to = new URL(typeof href === "string" ? href : (href.pathname ?? "/"), location.href).pathname;
        const direction = navDirection(location.pathname, to);
        if (direction) document.documentElement.dataset.nav = direction;
        else delete document.documentElement.dataset.nav;
        onClick?.(e);
      }}
    />
  );
}
