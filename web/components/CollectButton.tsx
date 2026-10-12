"use client";

import { toggleCollected, useCollection } from "@/lib/collection/store";

// Short label on cards ("+ Add"), full label where there's room (the big preview).
export default function CollectButton({ slug, title, focusable = true, long = false }: { slug: string; title: string; focusable?: boolean; long?: boolean }) {
  const saved = useCollection()?.includes(slug) ?? false;

  return (
    <button
      type="button"
      className={saved ? "md-collect is-saved" : "md-collect"}
      aria-pressed={saved}
      tabIndex={focusable ? undefined : -1}
      aria-label={saved ? `Remove ${title} from your collection` : `Add ${title} to your collection`}
      title={saved ? "In your collection" : "Add to your collection"}
      onClick={() => toggleCollected(slug)}
    >
      <span aria-hidden="true">{saved ? "✓" : "+"}</span>
      {long ? (saved ? "In collection" : "Add to collection") : saved ? "Added" : "Add"}
    </button>
  );
}
