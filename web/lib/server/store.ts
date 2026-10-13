import "server-only";
import { listGuidelines } from "@/lib/data/guidelines";
import { pikagoldFor, sameWallet } from "@/lib/likes/rules";
import { jsonFileStore } from "@/lib/server/json-file";
import { check, supabase } from "@/lib/server/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-side storage for used sign-in nonces, likes and profiles (ARCHITECTURE §10: auth_nonces,
// stars). Routes only talk to the AppStore interface. Supabase when SUPABASE_URL and
// SUPABASE_SECRET_KEY are set (web/supabase/migrations); otherwise the local dev file in
// development, and nothing in production: the routes answer 503 instead of pretending.
export interface AppStore {
  /** Marks a server-signed nonce as used until it expires. True the first time, false on a replay. */
  useNonce(nonce: string, expiresAt: Date): Promise<boolean>;
  /** Records a like (permanent, one per wallet). Null if the guideline isn't listed. */
  addLike(wallet: string, slug: string): Promise<{ created: boolean; count: number } | null>;
  /** Slugs this wallet liked. */
  likedSlugs(wallet: string): Promise<string[]>;
  /** Like count per listed guideline. */
  likeCounts(): Promise<Map<string, number>>;
  /** PikaGold (likes on the wallet's listed guidelines, K22) and how many it published. */
  profile(wallet: string): Promise<{ pikagold: number; guidelines: number }>;
}

// ── Supabase ───────────────────────────────────────────────────────────────────────────────

function supabaseStore(db: SupabaseClient): AppStore {
  return {
    async useNonce(nonce, expiresAt) {
      return check(await db.rpc("use_nonce", { p_nonce: nonce, p_expires_at: expiresAt.toISOString() }), "use_nonce") === true;
    },
    async addLike(wallet, slug) {
      const res = await db.rpc("add_like", { p_wallet: wallet.toLowerCase(), p_slug: slug });
      if (res.error?.code === "P0002") return null; // unknown, delisted or flagged
      const [row] = check(res, "add_like") as { created: boolean; like_count: number }[];
      return { created: row.created === true, count: Number(row.like_count) };
    },
    async likedSlugs(wallet) {
      return check(await db.rpc("liked_slugs", { p_wallet: wallet.toLowerCase() }), "liked_slugs") as string[];
    },
    async likeCounts() {
      const rows = check(await db.rpc("like_counts"), "like_counts") as { slug: string; like_count: number }[];
      return new Map(rows.map((r) => [r.slug, Number(r.like_count)]));
    },
    async profile(wallet) {
      const [row] = check(await db.rpc("wallet_profile", { p_wallet: wallet.toLowerCase() }), "wallet_profile") as {
        pikagold: number;
        guidelines: number;
      }[];
      return { pikagold: Number(row?.pikagold ?? 0), guidelines: Number(row?.guidelines ?? 0) };
    },
  };
}

// ── Local dev file (web/.data/, git-ignored) ───────────────────────────────────────────────

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
  useNonce: (nonce, expiresAt) =>
    devFile.update((s) => {
      const now = Date.now();
      const nonces = Object.fromEntries(Object.entries(s.nonces).filter(([, exp]) => exp > now));
      if (nonce in nonces) return { next: { ...s, nonces }, result: false };
      nonces[nonce] = expiresAt.getTime();
      return { next: { ...s, nonces }, result: true };
    }),

  async addLike(wallet, slug) {
    if (!(await listGuidelines()).some((g) => g.slug === slug)) return null;
    const created = await devFile.update((s) => {
      const w = key(wallet);
      if (s.likes.some((l) => l.wallet === w && l.slug === slug)) return { next: s, result: false };
      return { next: { ...s, likes: [...s.likes, { wallet: w, slug, at: new Date().toISOString() }] }, result: true };
    });
    return { created, count: (await devStore.likeCounts()).get(slug) ?? 0 };
  },

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

  async profile(wallet) {
    const [guidelines, counts] = await Promise.all([listGuidelines(), devStore.likeCounts()]);
    return {
      pikagold: pikagoldFor(wallet, guidelines, counts),
      guidelines: guidelines.filter((g) => sameWallet(g.author.address, wallet)).length,
    };
  },
};

/** The store, or null where none is configured (production without Supabase). */
export function getStore(): AppStore | null {
  const db = supabase();
  if (db) return supabaseStore(db);
  return process.env.NODE_ENV !== "production" ? devStore : null;
}
