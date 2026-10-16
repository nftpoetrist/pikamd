"use client";

import { useEffect, useState } from "react";
import { PixelStar } from "@/components/md-format";
import { TIPS } from "@/lib/chain";
import { openTipDialog } from "@/lib/tips/dialog";
import type { GuidelineCard } from "@/lib/types";

// ★ Tip (K21): opens the tip dialog for this guideline's author (components/tips/TipDialog.tsx).
// Where it can't tip, it says why in a balloon instead of pretending: no tips contract on this
// network, or a card that isn't on Arc yet (the Publish page's preview, id 0).
export default function TipButton({
  guideline,
  authorName,
  focusable = true,
}: {
  guideline: Pick<GuidelineCard, "id" | "title" | "author">;
  authorName: string;
  focusable?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [note]);

  const onClick = () => {
    if (guideline.id < 1) return setNote("Tips open once the guideline is published on Arc");
    if (!TIPS) return setNote(`Tips go wallet to wallet in USDC, 100% to ${authorName}. Not live on this network yet`);
    openTipDialog({ id: guideline.id, title: guideline.title, author: guideline.author.address as `0x${string}`, authorName });
  };

  return (
    <span className="md-tip-wrap">
      <button
        type="button"
        className="md-tip"
        aria-label={`Tip ${authorName} in USDC`}
        aria-haspopup="dialog"
        title="Tip the author in USDC"
        tabIndex={focusable ? undefined : -1}
        onClick={onClick}
      >
        <PixelStar size={13} />
        Tip
      </button>
      {note && (
        <span className="md-tip-note" role="status">
          {note}
        </span>
      )}
    </span>
  );
}
