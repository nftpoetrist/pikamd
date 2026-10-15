"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useConnectionEffect } from "wagmi";
import { PixelHeart } from "@/components/md-format";
import { useLike, useLikeSummary } from "@/lib/likes/client";
import { sameWallet } from "@/lib/likes/rules";
import { ApiError, describeError } from "@/lib/wallet/api";
import { openWalletModal, useWalletModalOpen } from "@/lib/wallet/modal";
import { useSessionWallet, useSignIn } from "@/lib/wallet/session";

// Like (heart) with the count (K22): needs a connected wallet and, once, a free sign-in
// signature. One like per wallet per guideline; pressing again takes it back. The first like
// earns the author 1 PikaGold, which stays when the like is taken back and isn't earned twice.
// The server enforces all of it; this button only guides the user through the steps.
export default function LikeButton({ slug, title, stars, focusable = true }: { slug: string; title: string; stars: number; focusable?: boolean }) {
  const { address, status } = useConnection();
  const session = useSessionWallet();
  const summary = useLikeSummary();
  const like = useLike();
  const signIn = useSignIn();
  const modalOpen = useWalletModalOpen();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Pressed before a wallet was connected: like as soon as one connects from that picker
  const waitingForWallet = useRef(false);

  const signedInHere = !!address && !!session.data && sameWallet(session.data, address);
  const liked = signedInHere && (summary.data?.mine.includes(slug) ?? false);
  const count = summary.data?.counts[slug] ?? stars;
  const unavailable = summary.error instanceof ApiError && summary.error.status === 503;

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [note]);

  const run = useCallback(
    async (wallet: `0x${string}`) => {
      setBusy(true);
      try {
        if (!session.data || !sameWallet(session.data, wallet)) await signIn(wallet);
        const result = await like.mutateAsync({ slug, like: true });
        if (result.liked && result.restored) setNote("Liked again. PikaGold was already given");
      } catch (error) {
        setNote(describeError(error, "Signature cancelled, nothing was liked"));
      } finally {
        setBusy(false);
      }
    },
    [session.data, signIn, like, slug],
  );

  // Signed in as this wallet already (that's how the button knows it's liked), so no signature
  const unlike = async () => {
    setBusy(true);
    try {
      const result = await like.mutateAsync({ slug, like: false });
      if (!result.liked) setNote("Like removed. The author keeps the PikaGold");
    } catch (error) {
      setNote(describeError(error, "Nothing was changed"));
    } finally {
      setBusy(false);
    }
  };

  useConnectionEffect({
    onConnect({ address: wallet }) {
      if (!waitingForWallet.current) return;
      waitingForWallet.current = false;
      void run(wallet);
    },
  });

  // Picker closed without connecting: forget the pending like
  useEffect(() => {
    if (!modalOpen && status === "disconnected") waitingForWallet.current = false;
  }, [modalOpen, status]);

  const onClick = () => {
    if (busy) return;
    if (unavailable) return setNote("Likes open with wallet sign-in. Coming soon");
    if (liked) return void unlike();
    if (status !== "connected" || !address) {
      waitingForWallet.current = true;
      openWalletModal();
      return;
    }
    void run(address);
  };

  const label = `${liked ? "Liked" : "Like"} ${title}, ${count} ${count === 1 ? "like" : "likes"}`;

  return (
    <span className="md-tip-wrap">
      <button
        type="button"
        className={liked ? "md-like is-on" : "md-like"}
        aria-pressed={liked}
        aria-busy={busy || undefined}
        aria-label={label}
        title={liked ? "You liked this. Press again to take it back" : "Like it (connect your wallet)"}
        tabIndex={focusable ? undefined : -1}
        onClick={onClick}
      >
        <PixelHeart size={14} />
        {count.toLocaleString("en-US")}
      </button>
      {note && (
        <span className="md-tip-note md-note-start" role="status">
          {note}
        </span>
      )}
    </span>
  );
}
