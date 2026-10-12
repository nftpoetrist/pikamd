import { useSyncExternalStore } from "react";

// Mock key record (roadmap step 3). Like the real design (ARCHITECTURE §8: the database keeps only
// a SHA-256 hash), the full key is never stored: this browser keeps the masked form and the date,
// so the page can say "you have a key" after a reload. Replaced by the mcp_keys API in step 8.
const STORAGE_KEY = "pikamd:mcp-key";

export type KeyRecord = { masked: string; createdAt: string };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: KeyRecord | undefined;
// In-memory fallback when storage is blocked (private mode, disabled site data).
let memory: KeyRecord | undefined;

function read(): KeyRecord | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : undefined;
      cached =
        parsed && typeof parsed === "object" && "masked" in parsed && "createdAt" in parsed &&
        typeof parsed.masked === "string" && typeof parsed.createdAt === "string"
          ? { masked: parsed.masked, createdAt: parsed.createdAt }
          : undefined;
    } catch {
      cached = undefined;
    }
  }
  return cached;
}

function write(record: KeyRecord | undefined) {
  memory = record;
  try {
    if (record) localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the in-memory record lasts until the page reloads.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

export const saveKeyRecord = (record: KeyRecord) => write(record);
export const revokeKeyRecord = () => write(undefined);

/** `null` until hydrated (the server can't see localStorage), then the record or `undefined`. */
export function useKeyRecord(): KeyRecord | undefined | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
