"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

// Publish → Details: asks the server whether a name is taken (app/api/names), so a hidden or
// locked guideline's name shows as taken here instead of failing at the last step. Asked once the
// author stops typing; until the answer comes, only the page's own list counts.
const WAIT_MS = 350;

export function useNameTaken(slug: string): boolean {
  const [asked, setAsked] = useState(slug);
  useEffect(() => {
    const t = window.setTimeout(() => setAsked(slug), WAIT_MS);
    return () => window.clearTimeout(t);
  }, [slug]);
  const answer = useQuery({
    queryKey: ["name-taken", asked],
    queryFn: async () => {
      const res = await fetch(`/api/names?slug=${encodeURIComponent(asked)}`, { cache: "no-store" });
      if (!res.ok) return false; // the server checks again when publishing
      return ((await res.json()) as { taken?: boolean }).taken === true;
    },
    enabled: asked !== "" && asked === slug,
    staleTime: 15_000,
    retry: false,
  });
  return asked === slug && answer.data === true;
}
