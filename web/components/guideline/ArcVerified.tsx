"use client";

import { useEffect, useState } from "react";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { readContract } from "wagmi/actions";
import { CHAIN, REGISTRY } from "@/lib/chain";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { wagmiConfig } from "@/lib/wallet/config";

type State = "checking" | "verified" | "mismatch" | "unrecorded" | "unavailable";

// "Verified on Arc" (ARCHITECTURE §7.2), checked in the visitor's own browser: the sha256 of the
// text on this page against the hash the registry holds for the latest version, read straight
// from Arc. Neither PikaMd's server nor its database is trusted for the answer.
export default function ArcVerified({ id, version, content }: { id: number; version: number; content: string }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!REGISTRY) return "unavailable" as const;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      const local = "0x" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const onChain = await readContract(wagmiConfig, {
        address: REGISTRY.address,
        abi: REGISTRY_ABI,
        functionName: "getVersion",
        args: [BigInt(id), version],
        chainId: CHAIN.id,
      });
      return onChain.contentHash.toLowerCase() === local ? ("verified" as const) : ("mismatch" as const);
    })()
      // The registry answering "no such guideline" is an answer, not an outage
      .catch((e: unknown) =>
        e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError) ? ("unrecorded" as const) : ("unavailable" as const),
      )
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [id, version, content]);

  const text: Record<State, string> = {
    checking: "Checking this text against Arc…",
    verified: "Verified on Arc: this text is exactly what the author recorded",
    mismatch: "This text doesn't match the record on Arc. Don't use it",
    unrecorded: "Arc has no record of this guideline",
    unavailable: "Couldn't reach Arc to check this text right now",
  };
  return (
    <p className={`gl-verify is-${state}`} role="status">
      <span aria-hidden="true">{state === "verified" ? "✓" : state === "mismatch" || state === "unrecorded" ? "✕" : "…"}</span>
      {text[state]}
    </p>
  );
}
