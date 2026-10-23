"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import CollectButton from "@/components/CollectButton";
import LikeButton from "@/components/LikeButton";
import { KIND_LABEL, shortAddress } from "@/components/md-format";
import MdPreview from "@/components/MdPreview";
import AuthorAction from "@/components/AuthorAction";
import ReviewedMark from "@/components/ReviewedMark";
import type { Guideline, GuidelineCard, OwnedGuideline } from "@/lib/types";
import { api } from "@/lib/wallet/api";

type PreviewState = "closed" | "open" | "closing";

const hasContent = (g: GuidelineCard | Guideline): g is Guideline => typeof (g as Guideline).content === "string";
const isOwned = (g: GuidelineCard | Guideline | OwnedGuideline): g is OwnedGuideline => typeof (g as OwnedGuideline).hidden === "boolean";

// focusable=false: duplicate cards in an endless lane stay out of the tab order.
// The third button is Tip, or Hide / Show on the connected wallet's own guidelines (AuthorAction).
// An OwnedGuideline (My Collection → Shared by me) that is hidden or locked is dimmed with a badge
// saying which, and OPEN, like and Add are inert (none of them works off the site); Show stays live.
// Pages send cards without the file (lib/data/guidelines.ts → listGuidelineCards); OPEN loads it
// once from /api/guidelines/[slug] (fetched ahead on hover or focus), the same query a search
// result uses. A card built in the browser (Publish's live preview) already has it.
export default function MdCard({ guideline, focusable = true }: { guideline: GuidelineCard | Guideline | OwnedGuideline; focusable?: boolean }) {
  const owned = isOwned(guideline) ? guideline : null;
  const off = owned?.locked ? "locked" : owned?.hidden ? "hidden" : undefined;
  const { slug, title, description, kind, tags, author, latestVersion, stars, reviewed } = guideline;
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
        className={off ? "md-card pixel-panel is-off" : "md-card pixel-panel"}
        aria-label={`${title} by ${authorName}${off === "hidden" ? " (hidden)" : off === "locked" ? " (locked by a moderator)" : ""}`}
      >
        <header className="md-card-head">
          <span className="md-file">{slug}.md</span>
          {off && (
            <span className="md-badge md-badge-off" title={off === "hidden" ? "Hidden: not on Explore, search or MCP" : "Locked by a moderator: off PikaMd"}>
              {off === "hidden" ? "HIDDEN" : "LOCKED"}
            </span>
          )}
          <span className="md-badge">{KIND_LABEL[kind]}</span>
          <span className="md-version">v{latestVersion}</span>
        </header>

        {/* The Reviewed badge sits at the right, under the type badge, without making the card taller */}
        <div className="md-title-row">
          <h3 className="md-title">{title}</h3>
          {reviewed && <ReviewedMark />}
        </div>

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
          <span className="md-tip-wrap" inert={!!off}>
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
          <span className="md-act" inert={!!off}>
            <LikeButton slug={slug} title={title} stars={stars} focusable={focusable} />
          </span>
          <AuthorAction guideline={guideline} authorName={authorName} hidden={owned?.hidden} focusable={focusable} />
          <span className="md-act md-act-grow" inert={!!off}>
            <CollectButton slug={slug} title={title} focusable={focusable} />
          </span>
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
