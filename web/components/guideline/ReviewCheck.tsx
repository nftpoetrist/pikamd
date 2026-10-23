"use client";

import { useEffect, useState } from "react";
import { readContract } from "wagmi/actions";
import { shortAddress } from "@/components/md-format";
import { CHAIN, REGISTRY, REVIEWS } from "@/lib/chain";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { MODERATOR_ROLE } from "@/lib/reviews/events";
import { REVIEWS_ABI } from "@/lib/reviews-abi";
import { wagmiConfig } from "@/lib/wallet/config";

type State =
  | { kind: "checking" }
  | { kind: "reviewed"; reviewer: `0x${string}`; at: Date }
  | { kind: "none" }
  | { kind: "other-version" }
  | { kind: "unavailable" };

const DAY = { month: "short", day: "numeric", year: "numeric" } as const;

// The "Reviewed" badge checked on Arc in the visitor's own browser (ARCHITECTURE §9.5), like
// "Verified on Arc": the approval in GuidelineReviews must name the version and hash on this page,
// the guideline must not be locked, and the wallet that approved it must still hold
// MODERATOR_ROLE. PikaMd's server and database aren't trusted for the answer.
export default function ReviewCheck({ id, version, contentHash }: { id: number; version: number; contentHash: `0x${string}` }) {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    (async (): Promise<State> => {
      if (!REVIEWS || !REGISTRY) return { kind: "unavailable" };
      const read = { chainId: CHAIN.id } as const;
      const [review, guideline] = await Promise.all([
        readContract(wagmiConfig, { ...read, address: REVIEWS.address, abi: REVIEWS_ABI, functionName: "getReview", args: [BigInt(id)] }),
        readContract(wagmiConfig, { ...read, address: REGISTRY.address, abi: REGISTRY_ABI, functionName: "getGuideline", args: [BigInt(id)] }),
      ]);
      if (review.version === 0 || guideline.moderatorLocked) return { kind: "none" };
      if (review.version !== version || review.contentHash.toLowerCase() !== contentHash.toLowerCase()) return { kind: "other-version" };
      const moderator = await readContract(wagmiConfig, { ...read, address: REGISTRY.address, abi: REGISTRY_ABI, functionName: "hasRole", args: [MODERATOR_ROLE, review.reviewer] });
      if (!moderator) return { kind: "none" };
      return { kind: "reviewed", reviewer: review.reviewer, at: new Date(Number(review.reviewedAt) * 1000) };
    })()
      .catch((): State => ({ kind: "unavailable" }))
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [id, version, contentHash]);

  if (!REVIEWS) return null;
  const text =
    state.kind === "checking"
      ? "Checking for a moderator review on Arc…"
      : state.kind === "reviewed"
        ? `Reviewed on Arc: a PikaMd moderator (${shortAddress(state.reviewer)}) approved this exact text on ${state.at.toLocaleDateString("en-US", DAY)}`
        : state.kind === "other-version"
          ? "A moderator reviewed another version of this file, not this one"
          : state.kind === "none"
            ? "Not reviewed by a PikaMd moderator yet"
            : "Couldn't reach Arc to check the review right now";
  const mark = state.kind === "reviewed" ? "✓" : "…";
  return (
    <p className={`gl-verify is-review is-${state.kind}`} role="status">
      <span aria-hidden="true">{mark}</span>
      {text}
    </p>
  );
}
