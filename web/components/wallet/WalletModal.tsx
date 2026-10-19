"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect, useConnection, useConnectors, type Connector } from "wagmi";
import { describeError } from "@/lib/wallet/api";
import { closeWalletModal, useWalletModalOpen } from "@/lib/wallet/modal";
import { dialogsSuspended, resumeDialogs, suspendDialogs } from "@/lib/wallet/suspend-dialogs";
import { WALLETCONNECT_ID, walletConnectConnector } from "@/lib/wallet/walletconnect";

// EIP-6963 wallets carry their rdns as id; WalletConnect is listed on its own below
const isDiscovered = (c: Connector) => c.id !== "injected" && c.id !== WALLETCONNECT_ID;
const CONNECT_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT = "connect-timeout";

// The wallet picker: browser wallets found through EIP-6963 and WalletConnect for phone wallets,
// in the site's pixel style.
// Native <dialog>: focus stays inside, Esc closes, the page behind is inert.
export default function WalletModal() {
  const open = useWalletModalOpen();
  const ref = useRef<HTMLDialogElement>(null);
  const connectors = useConnectors();
  const { status } = useConnection();
  const connect = useConnect();
  const [error, setError] = useState<string | null>(null);
  const [pickedUid, setPickedUid] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      connect.reset();
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    // connect.reset is stable for a mutation; the effect only follows `open`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Connected (from here or from the wallet itself): nothing left to pick
  useEffect(() => {
    if (open && status === "connected") closeWalletModal();
  }, [open, status]);

  const discovered = connectors.filter(isDiscovered);
  const hasLegacy = typeof window !== "undefined" && "ethereum" in window;
  const wallets = discovered.length > 0 ? discovered : hasLegacy ? connectors.filter((c) => !isDiscovered(c)) : [];

  // Some wallets never answer (locked, popup lost): stop waiting after 30 s (ARC.md §11, #10)
  const pick = async (connector: Connector) => {
    setError(null);
    setPickedUid(connector.uid);
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(CONNECT_TIMEOUT)), CONNECT_TIMEOUT_MS);
    });
    try {
      await Promise.race([connect.mutateAsync({ connector }), timeout]);
    } catch (e) {
      if (e instanceof Error && e.message === CONNECT_TIMEOUT) {
        connect.reset();
        setError("Your wallet didn't answer. Open it, unlock it and try again");
      } else {
        setError(describeError(e, "Connection cancelled in the wallet"));
      }
    } finally {
      window.clearTimeout(timer);
    }
  };

  // WalletConnect opens its own modal (QR code, or the wallet list on a phone). Our dialogs step
  // aside meanwhile (lib/wallet/suspend-dialogs.ts). No 30 s limit: scanning takes a while and the
  // person can close that modal. Connected: this picker stays closed and the rest (a tip, a report)
  // comes back. Closed or failed: the picker comes back with the reason.
  const pickWalletConnect = async () => {
    setError(null);
    setPickedUid(WALLETCONNECT_ID);
    suspendDialogs();
    try {
      await connect.mutateAsync({ connector: walletConnectConnector() });
      closeWalletModal();
      resumeDialogs([ref.current]);
    } catch (e) {
      resumeDialogs();
      setError(describeError(e, "Connection cancelled"));
    }
  };

  return (
    <dialog
      ref={ref}
      className="wallet-dialog"
      aria-labelledby="wallet-dialog-title"
      onClose={() => !dialogsSuspended() && closeWalletModal()}
      // A click on the dimmed area (the dialog box itself, outside the panel) closes it
      onClick={(e) => e.target === ref.current && closeWalletModal()}
      // Esc closes this picker only, not a guideline preview or the tip dialog underneath
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
    >
      {open && (
        <div className="wallet-panel pixel-panel">
          <header className="wallet-head">
            <h2 id="wallet-dialog-title">Connect a wallet</h2>
            <button type="button" className="mdp-close" aria-label="Close" title="Close (Esc)" onClick={closeWalletModal}>
              <svg width="12" height="12" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h3v3H2zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z" />
              </svg>
            </button>
          </header>

          <ul className="wallet-list">
            {wallets.map((c) => (
              <li key={c.uid}>
                <button type="button" className="wallet-option" disabled={connect.isPending} onClick={() => void pick(c)}>
                  {c.icon ? (
                    // Wallet-provided icon (EIP-6963 data URI); an <img> can't run script
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt="" width={28} height={28} />
                  ) : (
                    <span className="wallet-option-blank" aria-hidden="true" />
                  )}
                  <span>{c.id === "injected" ? "Browser wallet" : c.name}</span>
                  {connect.isPending && pickedUid === c.uid && <span className="wallet-option-wait">Check your wallet…</span>}
                </button>
              </li>
            ))}
            <li>
              <WalletConnectOption
                pending={connect.isPending}
                waiting={connect.isPending && pickedUid === WALLETCONNECT_ID}
                onPick={() => void pickWalletConnect()}
              />
            </li>
          </ul>

          {wallets.length === 0 && (
            <div className="wallet-empty">
              <p>No browser wallet found</p>
              <p>
                On a phone, use WalletConnect above or open this page in your wallet app&apos;s browser. On a computer, install one like{" "}
                <a href="https://metamask.io/download" target="_blank" rel="noopener noreferrer">
                  MetaMask
                </a>{" "}
                or{" "}
                <a href="https://rabby.io" target="_blank" rel="noopener noreferrer">
                  Rabby
                </a>
                , then reload this page
              </p>
            </div>
          )}

          {error && (
            <p className="wallet-error" role="alert">
              {error}
            </p>
          )}

          <p className="wallet-note">
            Connecting is free and only shares your public address. Your first like asks for one free signature, with no transaction and no gas
          </p>
        </div>
      )}
    </dialog>
  );
}

// Phone wallets through WalletConnect. Our own pixel phone-and-QR mark, not WalletConnect's logo.
function WalletConnectOption({ pending, waiting, onPick }: { pending: boolean; waiting: boolean; onPick: () => void }) {
  return (
    <button type="button" className="wallet-option" disabled={pending} onClick={onPick}>
      <svg className="wallet-option-wc" width="28" height="28" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d="M3 0h8v1H3zM2 1h1v12H2zM11 1h1v12h-1zM3 13h8v1H3zM6 11h2v1H6z" />
        <path fill="currentColor" d="M4 3h2v2H4zM8 3h2v2H8zM4 7h2v2H4zM7 6h1v1H7zM8 7h2v1H8zM9 8h1v1H9zM7 8h1v1H7z" />
      </svg>
      <span className="wallet-option-text">
        <span>WalletConnect</span>
        <span className="wallet-option-sub">Phone wallets, by QR code or link</span>
      </span>
      {waiting && <span className="wallet-option-wait">Waiting…</span>}
    </button>
  );
}
