// OAuth 2.1 for the MCP server (ARCHITECTURE §8.2): PikaMd is its own authorization server and the
// /mcp resource server. Everything here is pure (inputs in, answers out), so it runs in tests and
// on the server alike. Sources, read 2026-10-25: MCP authorization 2026-07-28
// (modelcontextprotocol.io/specification/2026-07-28/basic/authorization), Claude's connector
// authentication and lazy-authentication pages (claude.com/docs/connectors/building/…),
// RFC 6749, 6750, 7591, 7636, 8252, 8414, 8707, 9207, 9728 and the CIMD draft.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** The one permission a token can carry: read the wallet's saved guidelines (my_collection). */
export const SCOPE = "collection:read";
export const SCOPES_SUPPORTED = [SCOPE] as const;

export const ACCESS_TTL_S = 60 * 60; // short-lived (MCP security considerations, token theft)
export const REFRESH_TTL_S = 30 * 24 * 60 * 60; // rotated on every use; a month without use → sign in again
export const CODE_TTL_S = 60; // single use, exchanged right away by the client
export const REQUEST_TTL_S = 10 * 60; // a consent screen left open longer starts over

/** Token prefixes: an agent's header says at a glance what a value is; keys stay pmd_ + 40 hex. */
export const PREFIX = { access: "pmdat_", refresh: "pmdrt_", code: "pmdac_", request: "pmdar_", client: "pmdc_" } as const;
type Kind = keyof typeof PREFIX;

/** 32 random bytes (256 bits), base64url, behind its kind's prefix. */
export function newSecret(kind: Kind): string {
  return PREFIX[kind] + randomBytes(32).toString("base64url");
}

const SECRET_RE: Record<Kind, RegExp> = {
  access: /^pmdat_[A-Za-z0-9_-]{43}$/,
  refresh: /^pmdrt_[A-Za-z0-9_-]{43}$/,
  code: /^pmdac_[A-Za-z0-9_-]{43}$/,
  request: /^pmdar_[A-Za-z0-9_-]{43}$/,
  client: /^pmdc_[A-Za-z0-9_-]{43}$/,
};
export const isSecret = (kind: Kind, value: unknown): value is string => typeof value === "string" && SECRET_RE[kind].test(value);

/** What the database stores in place of a token, code or request id: its SHA-256, lowercase hex. */
export const sha256hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

// ── PKCE (RFC 7636): S256 only; "plain" and missing challenges are refused (OAuth 2.1 §4.1.1) ──
const PKCE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
export const isCodeVerifier = (v: unknown): v is string => typeof v === "string" && PKCE_RE.test(v);
export const isCodeChallenge = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
export const s256 = (verifier: string) => createHash("sha256").update(verifier, "ascii").digest("base64url");
/** Constant-time check that the verifier hashes to the challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!isCodeVerifier(verifier) || !isCodeChallenge(challenge)) return false;
  const a = Buffer.from(s256(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Origins, issuer and resource ─────────────────────────────────────────────────────────────

/**
 * The site's public origin for this request, or null if the host isn't one of ours. HTTPS for
 * every listed host; plain http only for localhost (development). The issuer and the resource are
 * built from it, so a request through an unknown host never gets a document naming that host.
 */
export function publicOrigin(requestUrl: string, allowedHosts: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (local) return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  if (url.protocol !== "https:" || !allowedHosts.includes(host)) return null;
  return url.origin;
}

export const issuerFor = (origin: string) => origin;
export const resourceFor = (origin: string) => `${origin}/mcp`;

/**
 * A `resource` parameter compared with our canonical MCP URL (RFC 8707): scheme and host are
 * compared case-insensitively (MCP: accept uppercase for robustness), one trailing slash is
 * ignored, and any query or fragment makes it a different resource.
 */
export function sameResource(given: string, canonical: string): boolean {
  let a: URL, b: URL;
  try {
    a = new URL(given);
    b = new URL(canonical);
  } catch {
    return false;
  }
  if (a.hash || a.search || a.username || a.password) return false;
  const path = (u: URL) => u.pathname.replace(/\/$/, "") || "/";
  return a.protocol === b.protocol && a.host.toLowerCase() === b.host.toLowerCase() && path(a) === path(b);
}

// ── Redirect URIs ───────────────────────────────────────────────────────────────────────────

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * A redirect URI a client may register: https (not to an IP literal), or http on a loopback host
 * (RFC 8252 native apps). MCP: "All redirect URIs MUST be either localhost or use HTTPS", so
 * custom schemes are refused. No fragment (RFC 6749 §3.1.2), no user info, at most 2,000 characters.
 */
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.hash || value.includes("#") || u.username || u.password) return false;
  if (u.protocol === "https:") return !LOOPBACK.has(u.hostname) && isIP(u.hostname.replace(/^\[|\]$/g, "")) === 0;
  return u.protocol === "http:" && LOOPBACK.has(u.hostname);
}

export const isLoopbackRedirect = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" && LOOPBACK.has(u.hostname);
  } catch {
    return false;
  }
};

/**
 * Does the requested redirect_uri match one the client registered? Exact string match, except a
 * loopback URI, where the port is ignored (RFC 8252 §7.3; Claude Code binds a new port each
 * session and declares http://localhost/callback and http://127.0.0.1/callback). Host, path and
 * query must still match exactly, and localhost never matches 127.0.0.1.
 */
export function redirectMatches(requested: string, registered: readonly string[]): boolean {
  if (!isAllowedRedirectUri(requested)) return false;
  if (registered.includes(requested)) return true;
  if (!isLoopbackRedirect(requested)) return false;
  const r = new URL(requested);
  return registered.some((uri) => {
    if (!isLoopbackRedirect(uri)) return false;
    const g = new URL(uri);
    return g.hostname === r.hostname && g.pathname === r.pathname && g.search === r.search;
  });
}

/** The host to show on the consent screen for a redirect URI (MCP: MUST display it clearly). */
export const redirectHost = (uri: string) => new URL(uri).host;

// ── Client ID Metadata Documents ────────────────────────────────────────────────────────────

/**
 * A client_id that names a CIMD (draft-ietf-oauth-client-id-metadata-document §3): https, a host
 * name (not an IP, not localhost), a path other than "/", no fragment, no user info, no dot
 * segments, at most 512 characters.
 */
export function isCimdClientId(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("https://")) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.href !== value) return false; // only the normalized spelling, so the string compare below is exact
  if (u.hash || u.username || u.password || u.pathname === "/" || /\/\.{1,2}(\/|$)/.test(u.pathname)) return false;
  const host = u.hostname;
  if (LOOPBACK.has(host) || host.endsWith(".localhost") || isIP(host.replace(/^\[|\]$/g, "")) !== 0) return false;
  return host.includes(".");
}

export type ClientInfo = {
  clientId: string;
  /** How the client identified itself: a metadata document (cimd) or dynamic registration (dcr). */
  kind: "cimd" | "dcr";
  /** The name the client gave itself. Self-asserted: never shown as the app's identity on its own. */
  name: string;
  /** For a CIMD client, the host of its client_id URL, the identity the consent screen names. */
  host: string | null;
  redirectUris: string[];
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "");

/** Validate a fetched CIMD document for `url`. Returns the client or a reason it's refused. */
export function parseCimd(url: string, doc: unknown): ClientInfo | { error: string } {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { error: "The client metadata isn't a JSON object" };
  const d = doc as Record<string, unknown>;
  if (d.client_id !== url) return { error: "The client metadata's client_id doesn't match its URL" };
  const name = text(d.client_name, 100);
  if (!name) return { error: "The client metadata has no client_name" };
  const uris = d.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 20 || !uris.every(isAllowedRedirectUri)) {
    return { error: "The client metadata's redirect_uris are missing or not allowed (https or localhost only)" };
  }
  if (d.token_endpoint_auth_method !== undefined && d.token_endpoint_auth_method !== "none") {
    return { error: "Only public clients (token_endpoint_auth_method none) are supported" };
  }
  if (d.grant_types !== undefined && !(Array.isArray(d.grant_types) && d.grant_types.includes("authorization_code"))) {
    return { error: "The client metadata doesn't allow the authorization_code grant" };
  }
  if (d.response_types !== undefined && !(Array.isArray(d.response_types) && d.response_types.includes("code"))) {
    return { error: "The client metadata doesn't allow the code response type" };
  }
  return { clientId: url, kind: "cimd", name, host: new URL(url).hostname, redirectUris: uris as string[] };
}

/** Validate a Dynamic Client Registration request (RFC 7591). Every client is public. */
export function parseRegistration(body: unknown): { name: string; redirectUris: string[] } | { error: string; field: "redirect_uris" | "metadata" } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Send the client metadata as a JSON object", field: "metadata" };
  const b = body as Record<string, unknown>;
  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10) return { error: "redirect_uris needs 1 to 10 URIs", field: "redirect_uris" };
  if (!uris.every(isAllowedRedirectUri)) return { error: "Redirect URIs must use https, or http on localhost", field: "redirect_uris" };
  if (b.grant_types !== undefined && !(Array.isArray(b.grant_types) && b.grant_types.every((g) => g === "authorization_code" || g === "refresh_token"))) {
    return { error: "Only the authorization_code and refresh_token grants are supported", field: "metadata" };
  }
  if (b.response_types !== undefined && !(Array.isArray(b.response_types) && b.response_types.every((r) => r === "code"))) {
    return { error: "Only the code response type is supported", field: "metadata" };
  }
  return { name: text(b.client_name, 100) || "Unnamed app", redirectUris: [...new Set(uris as string[])] };
}

// ── Addresses a server must never fetch (SSRF, CIMD §6) ─────────────────────────────────────

/** True for any address that isn't a public unicast one: loopback, private, link-local, CGNAT… */
export function isNonPublicAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 || // this network, private, loopback, multicast/reserved
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local (cloud metadata lives here)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || // IETF protocol assignments, TEST-NET-1 (192.0.2)
      (a === 198 && (b === 18 || b === 19 || b === 51)) || // benchmarking, TEST-NET-2
      (a === 203 && b === 0) // TEST-NET-3
    );
  }
  if (kind === 6) {
    const v = address.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isNonPublicAddress(mapped[1]);
    if (v.startsWith("::ffff:")) return true; // hex-written IPv4-mapped forms: refuse rather than parse
    const first = parseInt(v.split(":")[0] || "0", 16);
    return (
      (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
      (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
      (first & 0xff00) === 0xff00 || // multicast
      v.startsWith("64:ff9b:") || // NAT64
      v.startsWith("2001:db8:") || // documentation
      v.startsWith("2002:") // 6to4 can wrap any IPv4
    );
  }
  return true;
}

// ── Scope ───────────────────────────────────────────────────────────────────────────────────

/**
 * The scope granted for a requested one: always collection:read, the only thing PikaMd grants, and
 * what the consent screen describes. Unknown scopes (offline_access, openid…) are dropped: RFC 6749
 * §3.3 lets the server grant a different scope and the token response names it. Refresh tokens are
 * issued without offline_access. Only a malformed value (RFC 6749 §3.3 scope-token syntax) fails.
 */
export function grantedScope(requested: unknown): { scope: string } | { error: string } {
  if (requested === undefined || requested === null || requested === "") return { scope: SCOPE };
  if (typeof requested !== "string" || requested.length > 500 || !/^[\x21\x23-\x5b\x5d-\x7e]+( [\x21\x23-\x5b\x5d-\x7e]+)*$/.test(requested)) {
    return { error: "scope isn't valid" };
  }
  return { scope: SCOPE };
}

// ── Discovery documents ─────────────────────────────────────────────────────────────────────

/** RFC 8414 authorization server metadata. Both CIMD values Claude checks are present. */
export function authorizationServerMetadata(origin: string) {
  const issuer = issuerFor(origin);
  return {
    issuer,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: [...SCOPES_SUPPORTED],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/docs#connect`,
  };
}

/** RFC 9728 protected resource metadata for /mcp. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: resourceFor(origin),
    authorization_servers: [issuerFor(origin)],
    scopes_supported: [...SCOPES_SUPPORTED],
    bearer_methods_supported: ["header"],
    resource_name: "PikaMd",
    resource_documentation: `${origin}/docs#connect`,
  };
}

export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`;

/** The WWW-Authenticate challenge on a 401 from /mcp (RFC 6750 §3, RFC 9728 §5.1). */
export function bearerChallenge(origin: string, error?: { code: "invalid_token"; description: string }): string {
  const parts = [`resource_metadata="${resourceMetadataUrl(origin)}"`, `scope="${SCOPE}"`];
  if (error) parts.unshift(`error="${error.code}"`, `error_description="${error.description.replace(/["\\]/g, "")}"`);
  return `Bearer ${parts.join(", ")}`;
}

// ── Authorization responses ─────────────────────────────────────────────────────────────────

/** redirect_uri + code or error, with state and iss (RFC 9207) appended to its query. */
export function authorizationRedirect(
  redirectUri: string,
  params: { code: string } | { error: string; error_description?: string },
  state: string | null,
  issuer: string,
): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  if (state !== null) u.searchParams.set("state", state);
  u.searchParams.set("iss", issuer);
  return u.toString();
}

/** state is echoed back as given (any printable value up to 1,000 characters). */
export const isState = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(v);
