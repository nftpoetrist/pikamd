"use client";

import Link from "next/link";
import MdCard from "@/components/MdCard";
import { useCollection } from "@/lib/collection/store";
import type { GuidelineCard } from "@/lib/types";

// My Collection shelf: the guidelines saved on Explore, newest first, on a centered grid.
export default function CollectionPanel({ guidelines }: { guidelines: GuidelineCard[] }) {
  const slugs = useCollection();
  const bySlug = new Map(guidelines.map((g) => [g.slug, g]));
  const saved = (slugs ?? []).flatMap((slug) => bySlug.get(slug) ?? []);
  const count = saved.length;

  return (
    <section className="collection-panel pixel-panel" aria-label="Saved guidelines">
      <header className="collection-head">
        <h2 className="collection-heading">
          Saved guidelines
          <span className="collection-count" aria-label={`${count} saved`}>
            {slugs === null ? "–" : count}
          </span>
        </h2>
        <Link href="/connect" className="btn-ghost">
          Connect your agent
        </Link>
      </header>

      {/* Nothing until hydrated: the server can't see what this browser saved. */}
      {slugs === null ? null : count > 0 ? (
        <div className="collection-grid">
          {saved.map((g) => (
            <MdCard key={g.id} guideline={g} />
          ))}
        </div>
      ) : (
        <div className="collection-empty">
          <p className="collection-empty-title">Your library is empty.</p>
          <p className="collection-empty-text">
            Find a guideline on Explore and press <span>+ Add to collection</span>.
          </p>
          <Link href="/explore" className="btn-gold">
            Explore guidelines
          </Link>
        </div>
      )}
    </section>
  );
}
