import { connection } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth/core";
import { metadataResponse, preflight } from "@/lib/server/oauth-http";
import { originOf } from "@/lib/server/oauth";

// RFC 9728 §3.1 path-suffixed metadata for https://<host>/mcp: what the 401's resource_metadata
// points at, and the first place clients look without it.
export async function GET(request: Request) {
  await connection();
  const origin = originOf(request);
  if (!origin) return new Response("Unknown host", { status: 421 });
  return metadataResponse(protectedResourceMetadata(origin));
}

export const OPTIONS = preflight;
