import { connection } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth/core";
import { metadataResponse, preflight } from "@/lib/server/oauth-http";
import { originOf } from "@/lib/server/oauth";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// RFC 9728 §3.1 path-suffixed metadata for https://<host>/mcp: what the 401's resource_metadata
// points at, and the first place clients look without it.
export async function GET(request: Request) {
  await connection();
  const origin = originOf(request);
  if (!origin) return new Response("Unknown host", { status: 421 });
  return metadataResponse(protectedResourceMetadata(origin));
}

export const OPTIONS = preflight;
