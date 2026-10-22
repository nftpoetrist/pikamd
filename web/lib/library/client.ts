"use client";

import { useQuery } from "@tanstack/react-query";
import type { GuidelineCard } from "@/lib/types";
import { api } from "@/lib/wallet/api";

// The library in the browser. A page renders the cards from its prerendered shell (instant, maybe
// minutes old: lib/data/guidelines.ts, Freshness) and this asks the server for the current list
// whenever such a page opens, then swaps it in place: same cards keep their place, never a fallback.
// (No `initialData`: it reads the clock while rendering, which a prerendered page must not do.)
export const LIBRARY_KEY = ["library"] as const;

export function useLibrary(initial: GuidelineCard[]): GuidelineCard[] {
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: async () => (await api<{ guidelines: GuidelineCard[] }>("/api/guidelines")).guidelines,
    staleTime: 0,
    retry: false,
  });
  return data ?? initial;
}
