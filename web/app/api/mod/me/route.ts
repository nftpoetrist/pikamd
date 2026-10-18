import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE } from "@/lib/server/guard";
import { isModerator } from "@/lib/server/moderation";

// Whether the signed-in wallet holds MODERATOR_ROLE on Arc (for the /mod page and the wallet menu).
export async function GET() {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ moderator: false, signedIn: false }, { headers: NO_STORE });
  try {
    return Response.json({ moderator: await isModerator(wallet), signedIn: true }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "Couldn't check your role on Arc, try again" }, { status: 502, headers: NO_STORE });
  }
}
