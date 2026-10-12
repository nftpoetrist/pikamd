"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useConnection, useDisconnect } from "wagmi";
import CopyButton from "@/components/CopyButton";
import { PixelGold } from "@/components/md-format";
import { useProfile } from "@/lib/likes/client";
import { openWalletModal } from "@/lib/wallet/modal";

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const noop = () => () => {};

// Navbar wallet entry (K22): "Connect Wallet" until a wallet is connected, then the wallet's
// PikaGold and short address. Connecting needs no signature; the profile is public data.
export default function WalletButton({ className = "" }: { className?: string }) {
  // The server can't see the wallet: render the disconnected button until hydrated
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const { address, status } = useConnection();
  const connected = hydrated && status === "connected" && !!address;

  if (!connected) {
    return (
      <button type="button" className={`btn-ghost ${className}`} onClick={openWalletModal}>
        <span className="nav-dot" />
        Connect Wallet
      </button>
    );
  }
  return <ConnectedWallet address={address} className={className} />;
}

function ConnectedWallet({ address, className }: { address: `0x${string}`; className: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const profile = useProfile(address);
  const { mutate: disconnect } = useDisconnect();
  const gold = profile.data?.pikagold;

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

  const goldLabel = gold === undefined ? "PikaGold loading" : `${gold.toLocaleString("en-US")} PikaGold`;

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
        <span className="wallet-gold" aria-hidden="true">
          <PixelGold size={14} />
          {gold === undefined ? "…" : gold.toLocaleString("en-US")}
        </span>
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
            <PixelGold size={18} />
            <span>{goldLabel}</span>
          </p>
          <p className="wallet-menu-note">You earn 1 PikaGold for every like on guidelines you share</p>

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
