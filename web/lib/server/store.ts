import "server-only";
import { listGuidelines } from "@/lib/data/guidelines";
import { jsonFileStore } from "@/lib/server/json-file";

// Server-side storage for sign-in nonces and likes (ARCHITECTURE §10: auth_nonces, stars).
// Routes only talk to the AppStore interface. Today the only implementation is the local dev
// file; Supabase (roadmap step 6) replaces it here without touching the routes. Until then
// production has no store and the routes answer 503 instead of pretending.
export interface AppStore {
  /** Remembers a sign-in nonce until `expiresAt`. False if too many are pending (abuse guard). */
  saveNonce(nonce: string, expiresAt: Date): Promise<boolean>;
  /** Single use: true once for an unexpired nonce, then it's gone. */
  consumeNonce(nonce: string, now: Date): Promise<boolean>;
  /** Records a like. False if this wallet already liked this guideline (likes are permanent). */
  addLike(wallet: string, slug: string): Promise<boolean>;
  /** Slugs this wallet liked. */
  likedSlugs(wallet: string): Promise<string[]>;
  /** Like count per slug. */
  likeCounts(): Promise<Map<string, number>>;
}

const DEV_ENABLED = process.env.NODE_ENV !== "production";
const MAX_PENDING_NONCES = 10_000;

type Like = { wallet: string; slug: string; at: string };
type DevState = { nonces: Record<string, number>; likes: Like[] };

const devFile = jsonFileStore<DevState>("pikamd-dev.json", (raw) => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DevState>;
  const nonces: Record<string, number> = {};
  if (r.nonces && typeof r.nonces === "object") {
    for (const [k, v] of Object.entries(r.nonces)) if (typeof v === "number") nonces[k] = v;
  }
  const likes = Array.isArray(r.likes)
    ? r.likes.filter((l): l is Like => !!l && typeof l.wallet === "string" && typeof l.slug === "string" && typeof l.at === "string")
    : [];
  return { nonces, likes };
});

// Wallets are stored lowercase: one wallet, one row, whatever casing the client used.
const key = (wallet: string) => wallet.toLowerCase();

const devStore: AppStore = {
  saveNonce: (nonce, expiresAt) =>
    devFile.update((s) => {
      const now = Date.now();
      const nonces = Object.fromEntries(Object.entries(s.nonces).filter(([, exp]) => exp > now));
      if (Object.keys(nonces).length >= MAX_PENDING_NONCES) return { next: { ...s, nonces }, result: false };
      nonces[nonce] = expiresAt.getTime();
      return { next: { ...s, nonces }, result: true };
    }),

  consumeNonce: (nonce, now) =>
    devFile.update((s) => {
      const exp = s.nonces[nonce];
      if (exp === undefined) return { next: s, result: false };
      const nonces = { ...s.nonces };
      delete nonces[nonce];
      return { next: { ...s, nonces }, result: exp > now.getTime() };
    }),

  addLike: (wallet, slug) =>
    devFile.update((s) => {
      const w = key(wallet);
      if (s.likes.some((l) => l.wallet === w && l.slug === slug)) return { next: s, result: false };
      return { next: { ...s, likes: [...s.likes, { wallet: w, slug, at: new Date().toISOString() }] }, result: true };
    }),

  async likedSlugs(wallet) {
    const w = key(wallet);
    return (await devFile.read()).likes.filter((l) => l.wallet === w).map((l) => l.slug);
  },

  // Mock seed: each sample guideline's `stars` stands for likes from wallets that aren't in this
  // file, so a count is seed + real likes here. In Supabase it's simply count(*) from stars.
  async likeCounts() {
    const counts = new Map((await listGuidelines()).map((g) => [g.slug, g.stars] as [string, number]));
    for (const l of (await devFile.read()).likes) counts.set(l.slug, (counts.get(l.slug) ?? 0) + 1);
    return counts;
  },
};

/** The store, or null where none is configured yet (production before Supabase). */
export function getStore(): AppStore | null {
  return DEV_ENABLED ? devStore : null;
}
