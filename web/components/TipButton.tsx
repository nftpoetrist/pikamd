"use client";

import { useEffect, useState } from "react";
import { PixelStar } from "@/components/md-format";

// Tips to the author (K21) arrive in roadmap phase 6. Until then the button explains
// what it will do instead of pretending to send anything.
export default function TipButton({ author, focusable = true }: { author: string; focusable?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 2600);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <span className="md-tip-wrap">
      <button
        type="button"
        className="md-tip"
        aria-label={`Tip ${author} in USDC (coming soon)`}
        aria-expanded={open}
        title="Tip the author"
        tabIndex={focusable ? undefined : -1}
        onClick={() => setOpen((o) => !o)}
      >
        <PixelStar size={13} />
        Tip
      </button>
      {open && (
        <span className="md-tip-note" role="status">
          Tips go wallet to wallet in USDC, 100% to {author}. Coming soon
        </span>
      )}
    </span>
  );
}
