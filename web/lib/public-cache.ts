// How long Vercel's CDN keeps one copy of a public read (the library, a guideline, like counts,
// search results): ARCHITECTURE §12.3. Pure numbers, shared by the server (which sends the cache
// header, lib/server/guard.ts) and the browser (which steps around the copy after its own writes,
// lib/wallet/api.ts).

/** The copy counts as fresh for this long (s-maxage). */
export const PUBLIC_FRESH_SECONDS = 5;
/** After that, the old copy is still served for this long while one call refreshes it (stale-while-revalidate). */
export const PUBLIC_STALE_SECONDS = 10;
/**
 * After a browser changes something, its own reads skip the CDN copy for this long: twice the
 * time a copy made before the change can still be served.
 */
export const OWN_WRITE_FRESH_MS = 2 * (PUBLIC_FRESH_SECONDS + PUBLIC_STALE_SECONDS) * 1000;
