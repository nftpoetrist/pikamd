// Browser-side calls to this site's API, with the server's error message kept for the UI.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
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
