"use client";

import { useState, useSyncExternalStore } from "react";
import CopyButton from "@/components/CopyButton";

// Copy the file, save it as slug.md, or copy this page's link.
const noSubscribe = () => () => {};

export default function FileActions({ slug, content }: { slug: string; content: string }) {
  const [saved, setSaved] = useState(false);
  const link = useSyncExternalStore(noSubscribe, () => `${window.location.origin}/g/${slug}`, () => "");
  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="gl-file-actions">
      <CopyButton text={content} label="Copy file" />
      <button type="button" className={saved ? "btn-gold" : "btn-ghost"} onClick={download}>
        {saved ? "✓ Saved" : `Download ${slug}.md`}
      </button>
      <CopyButton text={link} label="Copy link" disabled={!link} />
    </div>
  );
}
