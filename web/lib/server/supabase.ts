import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client (ARCHITECTURE §10). Uses the project's secret key (sb_secret_…),
// which bypasses RLS; the database gives the public roles nothing (supabase/migrations), so this
// key must never reach the browser: no NEXT_PUBLIC_ prefix, and "server-only" above.
// Data API over HTTP, not a Postgres connection: serverless-friendly, no pool to exhaust.

let client: SupabaseClient | null | undefined;

/** The client, or null when SUPABASE_URL / SUPABASE_SECRET_KEY aren't set. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return (client = null);
  if (key.startsWith("sb_publishable_")) throw new Error("SUPABASE_SECRET_KEY holds a publishable key; use the project's secret key");
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

/** Throws a short error for a failed query; the detail goes to the server log only. */
export function check<T>(result: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) {
    console.error(`[supabase] ${what}: ${result.error.code ?? ""} ${result.error.message}`);
    throw new Error(`Database error (${what})`);
  }
  return result.data;
}
