"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useConnectionEffect } from "wagmi";
import { useCollect, useSavedSlugs } from "@/lib/collection/client";
import { sameWallet } from "@/lib/likes/rules";
import { ApiError, describeError } from "@/lib/wallet/api";
import { openWalletModal, useWalletModalOpen } from "@/lib/wallet/modal";
import { useSessionWallet, useSignIn } from "@/lib/wallet/session";

// Save to / remove from the wallet's collection (K12). Like the heart: needs a connected wallet
// and, once, the free sign-in signature; then one tap. Pressed before a wallet is connected, it
// saves as soon as one connects from the picker. Short label on cards ("+ Add"), full label where
// there's room (the big preview).
export default function CollectButton({ slug, title, focusable = true, long = false }: { slug: string; title: string; focusable?: boolean; long?: boolean }) {
  const { address, status } = useConnection();
  const session = useSessionWallet();
  const saved = useSavedSlugs();
  const collect = useCollect();
  const signIn = useSignIn();
  const modalOpen = useWalletModalOpen();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const waitingForWallet = useRef(false);

  const isSaved = saved.state === "ready" && saved.slugs.includes(slug);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3200);
    return () => window.clearTimeout(t);
  }, [note]);

  const run = useCallback(
    async (wallet: `0x${string}`, save: boolean) => {
      setBusy(true);
      try {
        if (!session.data || !sameWallet(session.data, wallet)) await signIn(wallet);
        await collect.mutateAsync({ slug, save });
        if (save) setNote("Saved. Your agent sees it over MCP");
      } catch (error) {
        if (error instanceof ApiError && error.status === 503) setNote("Collections open with wallet sign-in. Coming soon");
        else setNote(describeError(error, "Signature cancelled, nothing was saved"));
      } finally {
        setBusy(false);
      }
    },
    [session.data, signIn, collect, slug],
  );

  useConnectionEffect({
    onConnect({ address: wallet }) {
      if (!waitingForWallet.current) return;
      waitingForWallet.current = false;
      void run(wallet, true);
    },
  });

  // Picker closed without connecting: forget the pending save
  useEffect(() => {
    if (!modalOpen && status === "disconnected") waitingForWallet.current = false;
  }, [modalOpen, status]);

  const onClick = () => {
    if (busy) return;
    if (status !== "connected" || !address) {
      waitingForWallet.current = true;
      openWalletModal();
      return;
    }
    void run(address, !isSaved);
  };

  return (
    <span className="md-tip-wrap md-collect-wrap">
      <button
        type="button"
        className={isSaved ? "md-collect is-saved" : "md-collect"}
        aria-pressed={isSaved}
        aria-busy={busy || undefined}
        tabIndex={focusable ? undefined : -1}
        aria-label={isSaved ? `Remove ${title} from your collection` : `Add ${title} to your collection`}
        title={isSaved ? "In your collection. Press again to remove it" : "Add to your collection (connect your wallet)"}
        onClick={onClick}
      >
        <span aria-hidden="true">{isSaved ? "✓" : "+"}</span>
        {long ? (isSaved ? "In collection" : "Add to collection") : isSaved ? "Added" : "Add"}
      </button>
      {note && (
        <span className="md-tip-note md-note-end" role="status">
          {note}
        </span>
      )}
    </span>
  );
}
