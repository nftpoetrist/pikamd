"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import CopyButton from "@/components/CopyButton";
import PikaGoldCoin from "@/components/PikaGoldCoin";
import { PixelStar } from "@/components/md-format";
import PageLink from "@/components/PageLink";
import { useProfile } from "@/lib/likes/client";
import { isModeratorWallet } from "@/lib/chain";
import { sameWallet } from "@/lib/likes/rules";
import { useSessionWallet, useSignIn } from "@/lib/wallet/session";
import { formatUsdc } from "@/lib/tips/amount";
import { useKnownWallet } from "@/lib/wallet/known";
import { openWalletModal } from "@/lib/wallet/modal";

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const noop = () => () => {};

// Navbar wallet entry (K22): "Connect Wallet" until a wallet is connected, then the short address.
// The PikaGold count sits in its own box next to it (PikaGoldBox). Connecting needs no signature.
export default function WalletButton({ className = "" }: { className?: string }) {
  // The server can't see the wallet: render the disconnected button until hydrated
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const wallet = useKnownWallet();

  if (!hydrated || !wallet) {
    return (
      <button type="button" className={`btn-ghost ${className}`} onClick={openWalletModal}>
        <span className="nav-dot" />
        Connect Wallet
      </button>
    );
  }
  return <ConnectedWallet address={wallet} className={className} />;
}

function ConnectedWallet({ address, className }: { address: `0x${string}`; className: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const profile = useProfile(address);
  // Only the site's moderator wallet ever sees the desk (lib/chain.ts); everyone else gets a 404 there
  const moderator = isModeratorWallet(address);
  const { mutate: disconnect } = useDisconnect();
  const gold = profile.data?.pikagold;
  const tips = profile.data && /^\d+$/.test(profile.data.tipsReceived ?? "") ? BigInt(profile.data.tipsReceived) : undefined;
  const tipCount = profile.data?.tipsCount ?? 0;

  // Close on Esc or a click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const goldLabel =
    gold !== undefined
      ? `${gold.toLocaleString("en-US")} PikaGold`
      : profile.isError
        ? "PikaGold isn't available right now"
        : "PikaGold loading";

  return (
    <div ref={wrapRef} className={`wallet-wrap ${className}`}>
      <button
        type="button"
        className="btn-ghost wallet-chip"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Wallet ${shortAddress(address)}, ${goldLabel}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{shortAddress(address)}</span>
      </button>

      {open && (
        <div id={panelId} className="wallet-menu pixel-panel">
          <p className="wallet-menu-label">Connected wallet</p>
          <div className="wallet-menu-row">
            <code title={address}>{shortAddress(address)}</code>
            <CopyButton text={address} label="Copy address" />
          </div>

          <p className="wallet-menu-gold">
            <PikaGoldCoin clipId={`${panelId}-coin`} />
            <span>{goldLabel}</span>
          </p>
          <p className="wallet-menu-note">You earn 1 PikaGold for every like on guidelines you share</p>

          {tips !== undefined && (
            <>
              <p className="wallet-menu-tips">
                <PixelStar size={21} />
                <span>{formatUsdc(tips)} USDC in tips</span>
              </p>
              <p className="wallet-menu-note">
                {tipCount === 0
                  ? "Tips for your guidelines go straight to this wallet, in USDC"
                  : `From ${tipCount.toLocaleString("en-US")} ${tipCount === 1 ? "tip" : "tips"}, sent straight to this wallet`}
              </p>
            </>
          )}

          {moderator && <ModDeskLink address={address} onGo={() => setOpen(false)} />}

          <button
            type="button"
            className="btn-ghost wallet-disconnect"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// The desk opens only for a signed-in session of the moderator wallet (proxy.ts): sign in first
// with one free signature when there is no session yet, then go.
function ModDeskLink({ address, onGo }: { address: `0x${string}`; onGo: () => void }) {
  const session = useSessionWallet();
  const signIn = useSignIn();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "signing" | "failed">("idle");
  const signed = !!session.data && sameWallet(session.data, address);
  if (signed) {
    return (
      <PageLink href="/mod" className="wallet-mod" onClick={onGo}>
        Moderation desk →
      </PageLink>
    );
  }
  return (
    <button
      type="button"
      className="wallet-mod"
      disabled={state === "signing"}
      onClick={() => {
        setState("signing");
        signIn(address)
          .then(() => {
            onGo();
            router.push("/mod");
          })
          .catch(() => setState("failed"));
      }}
    >
      {state === "signing" ? "Check your wallet…" : state === "failed" ? "Sign in to open the desk →" : "Moderation desk →"}
    </button>
  );
}
