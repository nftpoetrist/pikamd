// Page order for directional page slides: the same left-to-right order as the menu.
// Going to a page further right slides the content left (forward), going back slides it right.
const ORDER: [prefix: string, rank: number][] = [
  ["/explore", 1],
  ["/g/", 1.5], // a guideline page sits just past Explore, where it was opened from
  ["/collection", 2],
  ["/connect", 3],
  ["/new", 4],
  ["/mod", 5],
  ["/docs", 6], // reached from the footer, after every menu page
];

export type NavDirection = "forward" | "back";

export function routeRank(pathname: string): number | null {
  if (pathname === "/") return 0;
  for (const [prefix, rank] of ORDER) {
    if (pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return rank;
  }
  return null;
}

/** Which way the page slides between two paths; null when the order is unknown or equal. */
export function navDirection(from: string, to: string): NavDirection | null {
  const a = routeRank(from);
  const b = routeRank(to);
  if (a === null || b === null || a === b) return null;
  return b > a ? "forward" : "back";
}
