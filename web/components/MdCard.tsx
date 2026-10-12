"use client";

import { useCallback, useRef, useState } from "react";
import CollectButton from "@/components/CollectButton";
import LikeButton from "@/components/LikeButton";
import { KIND_LABEL, shortAddress } from "@/components/md-format";
import MdPreview from "@/components/MdPreview";
import TipButton from "@/components/TipButton";
import type { Guideline } from "@/lib/types";

type PreviewState = "closed" | "open" | "closing";

// focusable=false: duplicate cards in an endless lane stay out of the tab order.
export default function MdCard({ guideline, focusable = true }: { guideline: Guideline; focusable?: boolean }) {
  const { slug, title, description, kind, tags, author, latestVersion, stars } = guideline;
  const authorName = author.handle ? `@${author.handle}` : shortAddress(author.address);
  const cardRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<PreviewState>("closed");

  const close = useCallback(() => setPreview((p) => (p === "open" ? "closing" : p)), []);
  // Focus goes back to the button that opened the preview.
  const closed = useCallback(() => {
    setPreview("closed");
    viewRef.current?.focus({ preventScroll: true });
  }, []);

  // The preview is a sibling, not a child, so its events don't bubble through the card.
  return (
    <>
      <article
        ref={cardRef}
        className="md-card pixel-panel"
        aria-label={`${title} by ${authorName}`}
      >
        <header className="md-card-head">
          <span className="md-file">{slug}.md</span>
          <span className="md-badge">{KIND_LABEL[kind]}</span>
          <span className="md-version">v{latestVersion}</span>
        </header>

        <h3 className="md-title">{title}</h3>

        <p className="md-summary">{description}</p>

        <footer className="md-card-foot">
          <span className="md-author">{authorName}</span>
          <span className="md-tags">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="md-tag">
                {tag}
              </span>
            ))}
          </span>
        </footer>

        <div className="md-card-actions">
          <button
            ref={viewRef}
            type="button"
            className="md-view"
            title="Open full file"
            aria-label={`Open ${title}`}
            aria-haspopup="dialog"
            tabIndex={focusable ? undefined : -1}
            onClick={() => setPreview("open")}
          >
            OPEN
          </button>
          <LikeButton slug={slug} title={title} stars={stars} focusable={focusable} />
          <TipButton author={authorName} focusable={focusable} />
          <CollectButton slug={slug} title={title} focusable={focusable} />
        </div>
      </article>

      {preview !== "closed" && (
        <MdPreview
          guideline={guideline}
          card={cardRef}
          closing={preview === "closing"}
          onClose={close}
          onClosed={closed}
        />
      )}
    </>
  );
}
