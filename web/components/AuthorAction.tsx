"use client";

import HideButton from "@/components/HideButton";
import TipButton from "@/components/TipButton";
import { useHydrated } from "@/lib/hydrated";
import { sameWallet } from "@/lib/likes/rules";
import type { GuidelineCard } from "@/lib/types";
import { useKnownWallet } from "@/lib/wallet/known";

// The third button on every card and preview: Tip for everyone else, Hide / Show for the author
// (tipping yourself means nothing). One place decides, so every page behaves the same. The
// author is whoever the connected wallet is; the contract checks it again (setHidden is author
// only). Only registered guidelines (on-chain ids start at 1) can be hidden: the Publish page's
// card preview (id 0) keeps Tip, as everyone else will see it. Until hydration ends it renders
// Tip, like the server (which can't see the wallet).
export default function AuthorAction({
  guideline,
  authorName,
  hidden = false,
  focusable = true,
}: {
  guideline: Pick<GuidelineCard, "id" | "title" | "author">;
  authorName: string;
  hidden?: boolean;
  focusable?: boolean;
}) {
  const hydrated = useHydrated();
  const wallet = useKnownWallet();
  const mine = hydrated && !!wallet && guideline.id >= 1 && sameWallet(wallet, guideline.author.address);
  if (!mine) return <TipButton guideline={guideline} authorName={authorName} focusable={focusable} />;
  return <HideButton id={guideline.id} title={guideline.title} hidden={hidden} focusable={focusable} />;
}
