import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";
import { isModeratorWallet } from "@/lib/chain";

// The moderation desk's front door (ARCHITECTURE §9.2). /mod exists only for the site's own
// moderator wallet (lib/chain.ts, MODERATOR_WALLETS) signed in with its session cookie: anyone else
// gets the site's 404, as if there were no such page, before anything is rendered and without a
// call to Arc. Fails closed: no secret, a forged or expired session, or another wallet → 404.
// Behind this door the page checks MODERATOR_ROLE on Arc, and every /api/mod route checks both
// again on its own (the door is never the only check).
export function proxy(request: NextRequest) {
  const secret = process.env.PIKAMD_SESSION_SECRET;
  let wallet: `0x${string}` | null = null;
  try {
    wallet = secret ? readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret, new Date()) : null;
  } catch {
    wallet = null;
  }
  if (wallet && isModeratorWallet(wallet)) return NextResponse.next();
  // A path no page answers: Next serves app/not-found with its 404 status
  return NextResponse.rewrite(new URL("/_no-such-page", request.url));
}

export const config = { matcher: ["/mod", "/mod/:path*"] };
