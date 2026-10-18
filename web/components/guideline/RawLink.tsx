"use client";

import { useSyncExternalStore } from "react";
import CopyButton from "@/components/CopyButton";

const noSubscribe = () => () => {};

// The raw file's full address on this site (/raw/slug.md): plain Markdown any agent can fetch.
export default function RawLink({ slug }: { slug: string }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const url = `${origin}/raw/${slug}.md`;
  return (
    <div className="gl-raw">
      <a href={`/raw/${slug}.md`} target="_blank" rel="noopener">
        <code>{url}</code>
      </a>
      <CopyButton text={url} label="Copy" disabled={!origin} />
    </div>
  );
}
