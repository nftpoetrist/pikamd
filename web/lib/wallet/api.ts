// Browser-side calls to this site's API, with the server's error message kept for the UI.

import { OWN_WRITE_FRESH_MS } from "@/lib/public-cache";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Public reads are kept by the CDN for a few seconds (lib/public-cache.ts), which is fine for
// what other people changed but not for what this browser just changed itself: after publishing,
// hiding or liking, the next page must show it. So every write through api() opens a short window
// in which this browser's public reads carry `?fresh=…`: a URL the CDN has no copy of.
const FRESH_KEY = "pikamd:fresh-until";
let freshUntil = 0;

function ownWrite() {
  freshUntil = Date.now() + OWN_WRITE_FRESH_MS;
  try {
    sessionStorage.setItem(FRESH_KEY, String(freshUntil)); // survives a reload of this tab
  } catch {
    // Blocked storage: the window still holds for this page
  }
}

/** The URL for a public, CDN-cached read: unchanged, or with `fresh` shortly after this browser's own write. */
export function publicRead(path: string): string {
  if (!freshUntil) {
    try {
      freshUntil = Number(sessionStorage.getItem(FRESH_KEY)) || 0;
    } catch {
      // Blocked storage: nothing to restore
    }
  }
  if (Date.now() >= freshUntil) return path;
  return `${path}${path.includes("?") ? "&" : "?"}fresh=${freshUntil}`;
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? "GET";
  // Before the call, not after: a write that reached the server counts even if its answer got lost
  if (method !== "GET") ownWrite();
  const res = await fetch(path, {
    method,
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Something went wrong, try again";
    throw new ApiError(error, res.status);
  }
  return data as T;
}

/** True when the user closed or declined the wallet prompt (EIP-1193 code 4001), at any depth. */
export function isUserRejection(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === "object" && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    const { code, name } = e as { code?: unknown; name?: unknown };
    if (code === 4001 || name === "UserRejectedRequestError") return true;
  }
  return false;
}

/** A short, honest message for a failed wallet or API step. */
export function describeError(error: unknown, rejected: string): string {
  if (isUserRejection(error)) return rejected;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong, try again";
}
