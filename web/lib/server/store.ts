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
  /**
   * Likes as this wallet. created = its first like here (the author earns 1 PikaGold);
   * restored = it liked before and took it back (no new PikaGold). Null if the guideline isn't listed.
   */
  addLike(wallet: string, slug: string): Promise<{ created: boolean; restored: boolean; count: number } | null>;
  /** Takes the wallet's like back; the author keeps the PikaGold. Null if the guideline isn't listed. */
  removeLike(wallet: string, slug: string): Promise<{ removed: boolean; count: number } | null>;
  /** Slugs this wallet currently likes. */
  likedSlugs(wallet: string): Promise<string[]>;
  /** Active like count per listed guideline. */
  likeCounts(): Promise<Map<string, number>>;
  /**
   * PikaGold (first likes on the wallet's guidelines, taken back or not, hidden ones included,
   * moderator-locked ones not: K22), how many it
   * published, and the tips it received through GuidelineTips (K21): the total in USDC units as a
   * decimal string (exact, any size) and how many.
   */
  profile(wallet: string): Promise<Profile>;
}

export type Profile = { pikagold: number; guidelines: number; tipsReceived: string; tipsCount: number };

// ── Supabase ───────────────────────────────────────────────────────────────────────────────

function supabaseStore(db: SupabaseClient): AppStore {
  return {
    async useNonce(nonce, expiresAt) {
      return check(await db.rpc("use_nonce", { p_nonce: nonce, p_expires_at: expiresAt.toISOString() }), "use_nonce") === true;
    },
    async addLike(wallet, slug) {
      const res = await db.rpc("add_like", { p_wallet: wallet.toLowerCase(), p_slug: slug });
      if (res.error?.code === "P0002") return null; // unknown, delisted or flagged
      const [row] = check(res, "add_like") as { created: boolean; restored: boolean; like_count: number }[];
      return { created: row.created === true, restored: row.restored === true, count: Number(row.like_count) };
    },
    async removeLike(wallet, slug) {
      const res = await db.rpc("remove_like", { p_wallet: wallet.toLowerCase(), p_slug: slug });
      if (res.error?.code === "P0002") return null;
      const [row] = check(res, "remove_like") as { removed: boolean; like_count: number }[];
      return { removed: row.removed === true, count: Number(row.like_count) };
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
        tips_received: string;
        tips_count: number;
      }[];
      const tips = typeof row?.tips_received === "string" && /^\d+$/.test(row.tips_received) ? row.tips_received : "0";
      return {
        pikagold: Number(row?.pikagold ?? 0),
        guidelines: Number(row?.guidelines ?? 0),
        tipsReceived: tips,
        tipsCount: Number(row?.tips_count ?? 0),
      };
    },
  };
}

// ── Local dev file (web/.data/, git-ignored) ───────────────────────────────────────────────

// A taken-back like keeps its row with `removed` set, so its PikaGold stays and can't be earned twice
type Like = { wallet: string; slug: string; at: string; removed?: string };
type DevState = { nonces: Record<string, number>; likes: Like[] };

const devFile = jsonFileStore<DevState>("pikamd-dev.json", (raw) => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DevState>;
  const nonces: Record<string, number> = {};
  if (r.nonces && typeof r.nonces === "object") {
    for (const [k, v] of Object.entries(r.nonces)) if (typeof v === "number") nonces[k] = v;
  }
  const likes = Array.isArray(r.likes)
    ? r.likes.filter(
        (l): l is Like =>
          !!l && typeof l.wallet === "string" && typeof l.slug === "string" && typeof l.at === "string" &&
          (l.removed === undefined || typeof l.removed === "string"),
      )
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
    const w = key(wallet);
    const { created, restored } = await devFile.update((s) => {
      const row = s.likes.find((l) => l.wallet === w && l.slug === slug);
      if (!row) {
        const likes = [...s.likes, { wallet: w, slug, at: new Date().toISOString() }];
        return { next: { ...s, likes }, result: { created: true, restored: false } };
      }
      if (!row.removed) return { next: s, result: { created: false, restored: false } };
      const likes = s.likes.map((l) => (l === row ? { wallet: l.wallet, slug: l.slug, at: l.at } : l));
      return { next: { ...s, likes }, result: { created: false, restored: true } };
    });
    return { created, restored, count: (await devStore.likeCounts()).get(slug) ?? 0 };
  },

  async removeLike(wallet, slug) {
    if (!(await listGuidelines()).some((g) => g.slug === slug)) return null;
    const w = key(wallet);
    const removed = await devFile.update((s) => {
      const row = s.likes.find((l) => l.wallet === w && l.slug === slug && !l.removed);
      if (!row) return { next: s, result: false };
      const likes = s.likes.map((l) => (l === row ? { ...l, removed: new Date().toISOString() } : l));
      return { next: { ...s, likes }, result: true };
    });
    return { removed, count: (await devStore.likeCounts()).get(slug) ?? 0 };
  },

  async likedSlugs(wallet) {
    const w = key(wallet);
    return (await devFile.read()).likes.filter((l) => l.wallet === w && !l.removed).map((l) => l.slug);
  },

  // Mock seed: each sample guideline's `stars` stands for likes from wallets that aren't in this
  // file, so a count is seed + real likes here. In Supabase it's simply count(*) from stars.
  likeCounts: () => devCounts({ active: true }),

  async profile(wallet) {
    const [guidelines, counts] = await Promise.all([listGuidelines(), devCounts({ active: false })]);
    return {
      pikagold: pikagoldFor(wallet, guidelines, counts),
      guidelines: guidelines.filter((g) => sameWallet(g.author.address, wallet)).length,
      // Tips are indexed in Supabase only (they're real Arc transactions); none in the local file
      tipsReceived: "0",
      tipsCount: 0,
    };
  },
};

// Active likes (the count shown) or every first like (what PikaGold counts)
async function devCounts({ active }: { active: boolean }) {
  const counts = new Map((await listGuidelines()).map((g) => [g.slug, g.stars] as [string, number]));
  for (const l of (await devFile.read()).likes) {
    if (!active || !l.removed) counts.set(l.slug, (counts.get(l.slug) ?? 0) + 1);
  }
  return counts;
}

/** The store, or null where none is configured (production without Supabase). */
export function getStore(): AppStore | null {
  const db = supabase();
  if (db) return supabaseStore(db);
  return process.env.NODE_ENV !== "production" ? devStore : null;
}
