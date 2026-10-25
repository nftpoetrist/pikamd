import { connection } from "next/server";
import { authorizationServerMetadata } from "@/lib/oauth/core";
import { metadataResponse, preflight } from "@/lib/server/oauth-http";
import { originOf } from "@/lib/server/oauth";

// RFC 8414 authorization server metadata. The issuer has no path, so this is its only well-known
// location (MCP discovery tries it first).
export async function GET(request: Request) {
  await connection();
  const origin = originOf(request);
  if (!origin) return new Response("Unknown host", { status: 421 });
  return metadataResponse(authorizationServerMetadata(origin));
}

export const OPTIONS = preflight;
