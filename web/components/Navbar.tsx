"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
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
    <Link key={href} href={href} className="nav-link" aria-current={isActive(href) ? "page" : undefined} onClick={onNavigate}>
      {isActive(href) && <span className="nav-dot" />}
      {label}
    </Link>
  ));
}

// The current path is runtime data on dynamic routes (/g/[slug]): read inside Suspense so those
// routes still prerender their shell; the fallback is the same links without the active marker.
function ActiveNavLinks({ onNavigate }: { onNavigate: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
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
        <Link href="/" className="nav-left" aria-label="PikaMd home">
          {/* The PikaMd pika, 32×32 pixels at 1:1 (2× on retina): inline SVG, sharp at every density */}
          <PikaSprite className="logo-sprite" blink />
          <span className="logo-text">
            Pika<span>Md</span>
          </span>
        </Link>

        {/* Dead center: nav-inner is a 3-column grid (1fr · auto · 1fr) */}
        <div className="nav-center hidden xl:flex">{links}</div>

        <div className="nav-right">
          <Link href="/new" className="btn-gold hidden sm:inline-flex">
            <span aria-hidden="true">+</span> Publish
          </Link>
          <WalletButton className="hidden sm:inline-flex" />
          <PikaGoldBox />
          <button
            type="button"
            className="nav-menu-btn xl:hidden"
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
        <div className="nav-mobile xl:hidden">
          {links}
          <Link href="/new" className="btn-gold mt-2 justify-center sm:hidden" onClick={() => setOpen(false)}>
            <span aria-hidden="true">+</span> Publish
          </Link>
          <WalletButton className="justify-center sm:hidden" />
        </div>
      )}
    </nav>
  );
}
