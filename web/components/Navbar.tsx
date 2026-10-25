"use client";

import PageLink from "@/components/PageLink";
import { usePathname } from "next/navigation";
import { Suspense, useLayoutEffect, useRef, useState } from "react";
import PikaSprite from "@/components/brand/PikaSprite";
import PikaGoldBox from "@/components/wallet/PikaGoldBox";
import WalletButton from "@/components/wallet/WalletButton";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/collection", label: "My Collection" },
  { href: "/connect", label: "Connect your agent" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  const isActive = (href: string) => pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return LINKS.map(({ href, label }) => (
    <PageLink key={href} href={href} className="nav-link" aria-current={isActive(href) ? "page" : undefined} onClick={onNavigate}>
      {isActive(href) && <span className="nav-dot" />}
      {label}
    </PageLink>
  ));
}

// The current path is runtime data on dynamic routes (/g/[slug]): read inside Suspense so those
// routes still prerender their shell; the fallback is the same links without the active marker.
function ActiveNavLinks({ onNavigate, indicator = false }: { onNavigate: () => void; indicator?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {indicator && <NavIndicator pathname={pathname} />}
      <NavLinks pathname={pathname} onNavigate={onNavigate} />
    </>
  );
}

// The gold frame of the desktop menu: one element under the links that slides to the active link
// in step with the page slide (globals.css, .nav-indicator). Off the menu (Home, Publish, a
// guideline page) it fades out where it is and fades back in on the next menu page.
function NavIndicator({ pathname }: { pathname: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const frame = ref.current;
    const row = frame?.parentElement;
    if (!frame || !row) return;
    // Slides only from a visible frame; the first placement and a reappearance just fade in
    const place = (slide: boolean) => {
      const active = row.querySelector<HTMLElement>('.nav-link[aria-current="page"]');
      if (!active) {
        frame.style.opacity = "0";
        shown.current = false;
        return;
      }
      // Fractional box (offsetLeft/offsetWidth round to whole pixels and leave the frame 1px off)
      const link = active.getBoundingClientRect();
      const to = { x: link.left - row.getBoundingClientRect().left, width: link.width };
      if (!slide || !shown.current) {
        frame.style.transition = "none";
        frame.style.width = `${to.width}px`;
        frame.style.transform = `translateX(${to.x}px)`;
        void frame.offsetWidth; // commit the jump before the opacity transition comes back
        frame.style.transition = "";
      } else {
        frame.style.width = `${to.width}px`;
        frame.style.transform = `translateX(${to.x}px)`;
      }
      frame.style.opacity = "1";
      shown.current = true;
    };
    place(true);
    // Web fonts and window resizes change the link widths: follow them without sliding.
    // The observer also reports once right away; that one would cut the slide short.
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (initial) initial = false;
      else place(false);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [pathname]);

  return <span ref={ref} className="nav-indicator" aria-hidden="true" />;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const links = (
    <Suspense fallback={<NavLinks pathname={null} onNavigate={close} />}>
      <ActiveNavLinks onNavigate={close} />
    </Suspense>
  );

  return (
    <nav className="navbar" aria-label="Main menu">
      <div className="navbar-bg" />

      <div className="nav-inner">
        <PageLink href="/" className="nav-left" aria-label="PikaMd home">
          {/* The PikaMd cat, 32×32 pixels at 1:1 (2× on retina): inline SVG, sharp at every density */}
          <PikaSprite className="logo-sprite" blink />
          <span className="logo-text">
            Pika<span>Md</span>
          </span>
        </PageLink>

        {/* One row from 1120px (centered between side columns that never shrink below their content), a second row from 640 to 1119px, the ☰ menu below (globals.css .nav-inner) */}
        <div className="nav-center">
          <Suspense fallback={<NavLinks pathname={null} onNavigate={close} />}>
            <ActiveNavLinks onNavigate={close} indicator />
          </Suspense>
        </div>

        <div className="nav-right">
          <PageLink href="/new" className="btn-gold hidden sm:inline-flex">
            <span aria-hidden="true">+</span> Publish
          </PageLink>
          <WalletButton className="hidden sm:inline-flex" />
          <PikaGoldBox />
          <button
            type="button"
            className="nav-menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
              {open ? (
                <path d="M3 3h3v3H3zM6 6h3v3H6zM9 9h3v3H9zM12 12h3v3h-3zM12 3h3v3h-3zM9 6h3v3H9zM6 9h3v3H6zM3 12h3v3H3z" />
              ) : (
                <path d="M2 3h14v3H2zM2 8h14v3H2zM2 13h14v3H2z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile">
          {links}
          <PageLink href="/new" className="btn-gold mt-2 justify-center sm:hidden" onClick={() => setOpen(false)}>
            <span aria-hidden="true">+</span> Publish
          </PageLink>
          <WalletButton className="justify-center sm:hidden" />
        </div>
      )}
    </nav>
  );
}
