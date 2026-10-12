"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import CollectButton from "@/components/CollectButton";
import LikeButton from "@/components/LikeButton";
import { KIND_LABEL, shortAddress } from "@/components/md-format";
import TipButton from "@/components/TipButton";
import type { Guideline } from "@/lib/types";

const OPEN_MS = 240;
const CLOSE_MS = 180;
const EASING = "steps(6, end)"; // frame by frame, like the rest of the pixel UI

// Transform that maps the centered panel back onto the source card (FLIP).
function fromCard(panel: HTMLElement, card: HTMLElement) {
  const to = panel.getBoundingClientRect();
  const from = card.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  return [
    { transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%) scale(${scale})` },
    { transform: "translate(0px, 0px) translate(-50%, -50%) scale(1)" },
  ];
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Markdown source view: syntax markers (#, -, 1., ---, >) in gold, headings brighter.
function SourceLine({ line }: { line: string }) {
  const match = line.match(/^(#{1,6} |- |\d+\. |> |---$)(.*)$/);
  if (!match) return <span className="mdp-line">{line || " "}</span>;
  const [, marker, rest] = match;
  return (
    <span className={marker.startsWith("#") ? "mdp-line mdp-heading" : "mdp-line"}>
      <span className="mdp-marker">{marker}</span>
      {rest}
    </span>
  );
}

type Props = {
  guideline: Guideline;
  card: RefObject<HTMLElement | null>;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
};

// Full-content view of a card: grows out of the card into the center of the screen,
// and shrinks back into it on close. Rendered in a portal above the page.
export default function MdPreview({ guideline, card, closing, onClose, onClosed }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { slug, title, description, kind, tags, author, latestVersion, stars, license, content } = guideline;
  const authorName = author.handle ? `@${author.handle}` : shortAddress(author.address);

  // Open: grow from the card. Lanes pause while a preview is up so the card stays put.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const root = document.documentElement;
    root.setAttribute("data-md-preview", "");
    closeRef.current?.focus({ preventScroll: true });
    // Cancelled on cleanup: a re-run must measure the panel at rest, not mid-animation.
    const anims: Animation[] = [];
    if (panel && card.current && !reducedMotion()) {
      anims.push(panel.animate(fromCard(panel, card.current), { duration: OPEN_MS, easing: EASING }));
      const backdrop = backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: EASING });
      if (backdrop) anims.push(backdrop);
    }
    return () => {
      anims.forEach((a) => a.cancel());
      root.removeAttribute("data-md-preview");
    };
  }, [card]);

  // Close: shrink back into the card, then unmount.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    if (!panel || !card.current || reducedMotion()) {
      onClosed();
      return;
    }
    const anim = panel.animate(fromCard(panel, card.current).reverse(), { duration: CLOSE_MS, easing: EASING, fill: "forwards" });
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: EASING, fill: "forwards" });
    anim.onfinish = onClosed;
    return () => {
      anim.onfinish = null;
    };
  }, [closing, card, onClosed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      {/* Clicking outside the panel closes it */}
      <div ref={backdropRef} className="mdp-backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} className="mdp-panel pixel-panel" role="dialog" aria-modal="true" aria-label={`${title}: full guideline`}>
        <header className="md-card-head">
          <span className="md-file">{slug}.md</span>
          <span className="md-badge">{KIND_LABEL[kind]}</span>
          <span className="md-version">v{latestVersion}</span>
          <button ref={closeRef} type="button" className="mdp-close" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h3v3H2zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z" />
            </svg>
          </button>
        </header>

        <h3 className="mdp-title">{title}</h3>
        <p className="mdp-summary">{description}</p>

        <pre className="mdp-source">
          {content.split("\n").map((line, i) => (
            <SourceLine key={i} line={line} />
          ))}
        </pre>

        <footer className="md-card-foot mdp-foot">
          <span className="md-author">{authorName}</span>
          <span className="mdp-license">{license === "CC0-1.0" ? "CC0" : "CC BY 4.0"}</span>
          <span className="md-tags">
            {tags.map((tag) => (
              <span key={tag} className="md-tag">
                {tag}
              </span>
            ))}
          </span>
        </footer>

        <div className="md-card-actions mdp-actions">
          <LikeButton slug={slug} title={title} stars={stars} />
          <TipButton author={authorName} />
          <CollectButton slug={slug} title={title} long />
        </div>
      </div>
    </>,
    document.body,
  );
}
