import type { Guideline } from "@/lib/types";
import { MOCK_GUIDELINES } from "@/lib/data/mock-guidelines";

// Single entry point for guideline reads. Pages only call these functions,
// so swapping mock data for Supabase (roadmap step 6) is a change in this file only.
export async function listGuidelines(): Promise<Guideline[]> {
  return MOCK_GUIDELINES;
}
