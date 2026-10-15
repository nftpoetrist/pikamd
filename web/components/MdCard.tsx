"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import CollectButton from "@/components/CollectButton";
import LikeButton from "@/components/LikeButton";
import { KIND_LABEL, shortAddress } from "@/components/md-format";
import MdPreview from "@/components/MdPreview";
import TipButton from "@/components/TipButton";
import type { Guideline, GuidelineCard } from "@/lib/types";
import { api } from "@/lib/wallet/api";

type PreviewState = "closed" | "open" | "closing";

const hasContent = (g: GuidelineCard | Guideline): g is Guideline => typeof (g as Guideline).content === "string";

// focusable=false: duplicate cards in an endless lane stay out of the tab order.
// Pages send cards without the file (lib/data/guidelines.ts → listGuidelineCards); OPEN loads it
// once from /api/guidelines/[slug] (fetched ahead on hover or focus), the same query a search
// result uses. A card built in the browser (Publish's live preview) already has it.
export default function MdCard({ guideline, focusable = true }: { guideline: GuidelineCard | Guideline; focusable?: boolean }) {
  const { slug, title, description, kind, tags, author, latestVersion, stars } = guideline;
  const authorName = author.handle ? `@${author.handle}` : shortAddress(author.address);
  const cardRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<PreviewState>("closed");
  const [full, setFull] = useState<Guideline | null>(hasContent(guideline) ? guideline : null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const client = useQueryClient();

  const fileQuery = { queryKey: ["guideline", slug], queryFn: () => api<Guideline>(`/api/guidelines/${encodeURIComponent(slug)}`), staleTime: 60_000 };
  const prefetch = () => {
    if (!hasContent(guideline)) void client.prefetchQuery(fileQuery);
  };
  const open = async () => {
    if (loading) return;
    if (hasContent(guideline)) {
      setFull(guideline);
      return setPreview("open");
    }
    setLoading(true);
    try {
      setFull(await client.fetchQuery(fileQuery));
      setPreview("open");
    } catch {
      setNote("Couldn't open this guideline, try again");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [note]);

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
          <span className="md-tip-wrap">
            <button
              ref={viewRef}
              type="button"
              className="md-view"
              title="Open full file"
              aria-label={`Open ${title}`}
              aria-haspopup="dialog"
              aria-busy={loading || undefined}
              tabIndex={focusable ? undefined : -1}
              onPointerEnter={prefetch}
              onFocus={prefetch}
              onClick={() => void open()}
            >
              OPEN
            </button>
            {note && (
              <span className="md-tip-note md-note-start" role="status">
                {note}
              </span>
            )}
          </span>
          <LikeButton slug={slug} title={title} stars={stars} focusable={focusable} />
          <TipButton author={authorName} focusable={focusable} />
          <CollectButton slug={slug} title={title} focusable={focusable} />
        </div>
      </article>

      {preview !== "closed" && full && (
        <MdPreview
          guideline={full}
          card={cardRef}
          closing={preview === "closing"}
          onClose={close}
          onClosed={closed}
        />
      )}
    </>
  );
}
