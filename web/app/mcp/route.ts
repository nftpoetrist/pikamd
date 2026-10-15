import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { collectionForKey } from "@/lib/mcp/mock-store";
import { buildMcpServer } from "@/lib/mcp/server";

// PikaMd MCP server (ARCHITECTURE §8, K10/K11): Streamable HTTP, stateless.
// createMcpHandler serves 2026-07-28 clients and, through its stateless fallback, 2025-era
// clients from the same factory; GET/DELETE (2025 session operations) get 405.
// It does no auth and no Host/Origin checks of its own, so both happen here first.

// DNS rebinding protection: localhost always, plus the deployed domain(s) once there is one.
const extraHosts = (process.env.PIKAMD_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const allowedHosts = [...localhostAllowedHostnames(), ...extraHosts];
const allowedOrigins = [...localhostAllowedOrigins(), ...extraHosts];

const handler = createMcpHandler(
  ({ authInfo, requestInfo }) => {
    const saved = authInfo?.extra?.collection;
    return buildMcpServer({
      collection: Array.isArray(saved) ? saved.filter((s): s is string => typeof s === "string") : null,
      connectUrl: requestInfo ? new URL("/connect", requestInfo.url).toString() : "/connect",
    });
  },
  // Reporting only. Never log request headers: they carry the user's key.
  // Tool calls are a few hundred bytes; the SDK's default body limit is 4 MiB.
  { onerror: (error) => console.error(`[mcp] ${error.message}`), maxRequestBodySize: 64 * 1024 },
);

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

async function serve(request: Request): Promise<Response> {
  const rejected =
    hostHeaderValidationResponse(request, allowedHosts) ?? originValidationResponse(request, allowedOrigins);
  if (rejected) return rejected;

  // Public tools work without a key. A missing or wrong key only matters to my_collection,
  // which answers with a tool error that says where to get one (API key mode, K11; no OAuth yet).
  const token = bearerToken(request.headers.get("authorization"));
  const collection = token ? await collectionForKey(token) : null;
  const authInfo = token && collection ? { token, clientId: "pikamd-api-key", scopes: ["collection:read"], extra: { collection } } : undefined;

  return handler.fetch(request, { authInfo });
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
