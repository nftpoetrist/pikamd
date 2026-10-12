import { useSyncExternalStore } from "react";
import { syncCollection } from "@/lib/mcp/mock-sync";

// Mock per-viewer stores (roadmap step 3): slugs live in this browser's localStorage so
// collect and like can be designed end to end. Replaced by the real API in step 8
// (collections + stars tables, Supabase + SIWE session, ARCHITECTURE §10).
const EMPTY: readonly string[] = [];

function createSlugStore(key: string, onChange?: (slugs: readonly string[]) => void) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedSlugs: readonly string[] = EMPTY;

  function read(): readonly string[] {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // Storage blocked (private mode, disabled site data): keep the in-memory copy.
      return cachedSlugs;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        cachedSlugs = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : EMPTY;
      } catch {
        cachedSlugs = EMPTY;
      }
    }
    return cachedSlugs;
  }

  function write(slugs: readonly string[]) {
    try {
      localStorage.setItem(key, JSON.stringify(slugs));
    } catch {
      // Storage blocked: the toggle still works in memory until the page reloads.
      cachedSlugs = slugs;
    }
    listeners.forEach((notify) => notify());
  }

  function subscribe(notify: () => void) {
    listeners.add(notify);
    // Keep other tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) notify();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    // Newest first, so the latest pick shows up at the top of My Collection.
    toggle(slug: string) {
      const slugs = read();
      const next = slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [slug, ...slugs];
      write(next);
      onChange?.(next);
    },
    /** Slugs, newest first. `null` until hydrated (the server can't see localStorage). */
    use(): readonly string[] | null {
      return useSyncExternalStore(subscribe, read, () => null);
    },
  };
}

// The collection is mirrored to the local MCP preview so my_collection can see it (lib/mcp/mock-sync.ts).
const collection = createSlugStore("pikamd:collection", syncCollection);
const likes = createSlugStore("pikamd:likes");

export const toggleCollected = collection.toggle;
export const useCollection = () => collection.use();

export const toggleLiked = likes.toggle;
export const useLikes = () => likes.use();
