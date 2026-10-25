import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { isKey } from "@/lib/mcp/connect";
import { buildMcpServer } from "@/lib/mcp/server";
import { SCOPE, bearerChallenge, isSecret, resourceFor, resourceMetadataUrl } from "@/lib/oauth/core";
import { collectionForKey } from "@/lib/server/collection";
import { ALLOWED_HOSTS, accessGrant, originOf } from "@/lib/server/oauth";

// PikaMd MCP server (ARCHITECTURE §8, K10/K11, §8.2): Streamable HTTP, stateless.
// createMcpHandler serves 2026-07-28 clients and, through its stateless fallback, 2025-era
// clients from the same factory; GET/DELETE (2025 session operations) get 405.
// It does no auth and no Host/Origin checks of its own, so both happen here first.
//
// Lazy authentication (claude.com/docs/connectors/building/lazy-authentication): connecting,
// listing tools, search_guidelines and get_guideline need nothing. my_collection needs either an
// OAuth access token (sign-in with the wallet) or a PikaMd key (pmd_…, made on /connect). Called
// without one, the request is refused with 401 and a WWW-Authenticate challenge before the SDK
// runs: inside the SDK a refusal would become a 200 tool error, which starts no sign-in.

const allowedHosts = [...localhostAllowedHostnames(), ...ALLOWED_HOSTS];
const allowedOrigins = [...localhostAllowedOrigins(), ...ALLOWED_HOSTS];
const MAX_BODY = 64 * 1024; // tool calls are a few hundred bytes; the SDK's default is 4 MiB

const handler = createMcpHandler(
  ({ authInfo, requestInfo }) => {
    const saved = authInfo?.extra?.collection;
    return buildMcpServer({
      collection: Array.isArray(saved) ? saved.filter((s): s is string => typeof s === "string") : null,
      connectUrl: requestInfo ? new URL("/connect", requestInfo.url).toString() : "/connect",
    });
  },
  // Reporting only. Never log request headers: they carry the user's key or token.
  { onerror: (error) => console.error(`[mcp] ${error.message}`), maxRequestBodySize: MAX_BODY },
);

/** Tools that act on the user's own data; everything else is public. */
const PROTECTED_TOOLS = new Set(["my_collection"]);

const BODY_TIMEOUT_MS = 10_000;
const jsonRpcError = (status: number, message: string) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status });

/**
 * The request body, read once, as a stream with a size and a time limit. The gate below needs to
 * look at it before the SDK does; reading a clone instead (request.clone() tees the stream) left
 * the SDK's copy stalled when a large chunked body was cut short, holding the function for minutes.
 */
async function readBody(request: Request): Promise<Uint8Array<ArrayBuffer> | Response> {
  if (Number(request.headers.get("content-length")) > MAX_BODY) return jsonRpcError(413, `Payload Too Large: Request body must not exceed ${MAX_BODY} bytes`);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), BODY_TIMEOUT_MS);
  });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next === "timeout") {
        // Not awaited: a cancel waits for the pending read, which is the very thing that stalled
        reader.cancel().catch(() => {});
        return jsonRpcError(408, "Request Timeout: the body took too long to arrive");
      }
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel().catch(() => {});
        return jsonRpcError(413, `Payload Too Large: Request body must not exceed ${MAX_BODY} bytes`);
      }
      chunks.push(next.value);
    }
  } catch {
    return jsonRpcError(400, "Bad Request: the body couldn't be read");
  } finally {
    clearTimeout(timer);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Does this JSON-RPC body (one message or a batch) call a protected tool? Unparseable bodies are left to the SDK. */
function callsProtectedTool(body: Uint8Array): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body).toString("utf8"));
  } catch {
    return false;
  }
  return (Array.isArray(parsed) ? parsed : [parsed]).some((m) => {
    if (!m || typeof m !== "object") return false;
    const msg = m as { method?: unknown; params?: { name?: unknown } };
    return msg.method === "tools/call" && typeof msg.params?.name === "string" && PROTECTED_TOOLS.has(msg.params.name);
  });
}

const challenge = (origin: string, error?: string) =>
  new Response(JSON.stringify({ error: "invalid_token", error_description: error ?? "Sign in to PikaMd to use this tool" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": bearerChallenge(origin, error ? { code: "invalid_token", description: error } : undefined),
    },
  });

/** Who the request acts for: nobody, a wallet (from a key or a token), or a refusal. */
async function authenticate(request: Request, origin: string): Promise<AuthInfo | Response | null> {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const token = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return challenge(origin, "Send the token as Authorization: Bearer <token>");

  if (isKey(token)) {
    const collection = await collectionForKey(token);
    if (!collection) return challenge(origin, "This PikaMd key is unknown or revoked. Sign in again or create a new key");
    return { token, clientId: "pikamd-api-key", scopes: [SCOPE], extra: { collection } };
  }
  if (isSecret("access", token)) {
    const resource = resourceFor(origin);
    const grant = await accessGrant(token, resource);
    if (!grant) return challenge(origin, "The access token is invalid, expired or revoked");
    return {
      token,
      clientId: grant.clientId,
      scopes: grant.scopes,
      expiresAt: grant.expiresAt,
      resource: new URL(resource),
      extra: { collection: grant.collection },
    };
  }
  // MCP: servers MUST only accept tokens issued for themselves
  return challenge(origin, "This token wasn't issued by PikaMd");
}

async function serve(request: Request): Promise<Response> {
  const rejected =
    hostHeaderValidationResponse(request, allowedHosts) ?? originValidationResponse(request, allowedOrigins);
  if (rejected) return rejected;
  const origin = originOf(request);
  if (!origin) return new Response("Unknown host", { status: 421 });

  let auth: AuthInfo | Response | null;
  try {
    auth = await authenticate(request, origin);
  } catch {
    return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Couldn't check the credentials, try again" }, id: null }, { status: 503 });
  }
  if (auth instanceof Response) return auth;

  // POST carries the JSON-RPC body; GET and DELETE go straight to the SDK (it answers 405)
  let forward = request;
  if (request.method === "POST") {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    forward = new Request(request.url, { method: "POST", headers, body });
    if (!callsProtectedTool(body)) return handler.fetch(forward, auth ? { authInfo: auth } : undefined);
    if (!auth) return challenge(origin);
    if (!auth.scopes.includes(SCOPE)) {
      return new Response(JSON.stringify({ error: "insufficient_scope", error_description: "This needs access to your collection" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${SCOPE}", resource_metadata="${resourceMetadataUrl(origin)}"`,
        },
      });
    }
  }
  return handler.fetch(forward, auth ? { authInfo: auth } : undefined);
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
