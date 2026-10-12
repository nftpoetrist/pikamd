"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect, useConnection, useConnectors, type Connector } from "wagmi";
import { describeError } from "@/lib/wallet/api";
import { closeWalletModal, useWalletModalOpen } from "@/lib/wallet/modal";

const isDiscovered = (c: Connector) => c.id !== "injected"; // EIP-6963 wallets carry their rdns as id
const CONNECT_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT = "connect-timeout";

// The wallet picker: browser wallets found through EIP-6963, in the site's pixel style.
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

  return (
    <dialog
      ref={ref}
      className="wallet-dialog"
      aria-labelledby="wallet-dialog-title"
      onClose={closeWalletModal}
      // A click on the dimmed area (the dialog box itself, outside the panel) closes it
      onClick={(e) => e.target === ref.current && closeWalletModal()}
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

          {wallets.length > 0 ? (
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
            </ul>
          ) : (
            <div className="wallet-empty">
              <p>No browser wallet found</p>
              <p>
                Install one, like{" "}
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
