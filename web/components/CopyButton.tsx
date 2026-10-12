"use client";

import { useEffect, useRef, useState } from "react";

// Copies text and turns gold for a moment ("✓ Copied"), same feedback as Publish's Copy prompt.
export default function CopyButton({ text, label = "Copy", disabled = false }: { text: string; label?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the text stays selectable on the page.
    }
  };

  return (
    <button type="button" className={copied ? "btn-gold" : "btn-ghost"} onClick={copy} disabled={disabled} aria-live="polite">
      {copied ? "✓ Copied" : label}
    </button>
  );
}
