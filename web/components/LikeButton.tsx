"use client";

import { PixelHeart } from "@/components/md-format";
import { toggleLiked, useLikes } from "@/lib/collection/store";

// Like toggle (heart) with the count. Stored as `stars` in the data model (ARCHITECTURE §10).
// Mock: per browser until step 8.
export default function LikeButton({ slug, title, stars, focusable = true }: { slug: string; title: string; stars: number; focusable?: boolean }) {
  const liked = useLikes()?.includes(slug) ?? false;
  const count = stars + (liked ? 1 : 0);

  return (
    <button
      type="button"
      className={liked ? "md-like is-on" : "md-like"}
      aria-pressed={liked}
      aria-label={`${liked ? "Unlike" : "Like"} ${title}, ${count} ${count === 1 ? "like" : "likes"}`}
      title={liked ? "Liked" : "Like it"}
      tabIndex={focusable ? undefined : -1}
      onClick={() => toggleLiked(slug)}
    >
      <PixelHeart size={14} />
      {count.toLocaleString("en-US")}
    </button>
  );
}
