"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSignedIn } from "@/lib/collection/client";
import { NOTE_MAX, REPORT_REASONS, type ReportReason } from "@/lib/moderation/reasons";
import { messageFor } from "@/lib/publish/client";
import { api } from "@/lib/wallet/api";
import { openWalletModal } from "@/lib/wallet/modal";
import { dialogsSuspended } from "@/lib/wallet/suspend-dialogs";
import { useSignIn } from "@/lib/wallet/session";

// ⚑ Report (ARCHITECTURE §9.2): a reason and an optional note go to the moderators (/mod). Needs a
// connected wallet and the free sign-in, so one wallet reports a guideline once.
export default function ReportButton({ slug, title }: { slug: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { wallet, signed } = useSignedIn();
  const signIn = useSignIn();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const start = () => {
    setError(null);
    setDone(null);
    setOpen(true);
  };

  const send = async () => {
    setError(null);
    if (!wallet) return openWalletModal();
    if (!reason) return setError("Pick a reason");
    if (reason === "other" && !note.trim()) return setError("Tell us what's wrong in the note");
    setBusy(true);
    try {
      if (!signed) await signIn(wallet);
      const r = await api<{ first: boolean }>("/api/reports", { method: "POST", body: { slug, reason, note: note.trim() } });
      setDone(r.first ? "Thanks. A moderator will look at it" : "You've reported this guideline already. A moderator will look at it");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="gl-report" onClick={start} aria-haspopup="dialog">
        <span aria-hidden="true">⚑</span> Report this guideline
      </button>
      <dialog
        ref={ref}
        className="wallet-dialog"
        aria-labelledby={`${id}-title`}
        // A WalletConnect modal sets it aside for a moment (lib/wallet/suspend-dialogs.ts): not a real close
        onClose={() => !dialogsSuspended() && setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      >
        {open && (
          <div className="wallet-panel pixel-panel report-panel">
            <header className="wallet-head">
              <h2 id={`${id}-title`}>Report a guideline</h2>
              <button type="button" className="mdp-close" aria-label="Close" title="Close (Esc)" onClick={() => setOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
                  <path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h3v3H2zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z" />
                </svg>
              </button>
            </header>
            {done ? (
              <div className="report-done" role="status">
                <p>{done}</p>
                <button type="button" className="btn-gold" onClick={() => setOpen(false)} autoFocus>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="report-for">{title}</p>
                <fieldset className="report-reasons" disabled={busy}>
                  <legend>What&apos;s wrong with it?</legend>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.code} className={reason === r.code ? "is-on" : ""}>
                      <input type="radio" name={`${id}-reason`} checked={reason === r.code} onChange={() => setReason(r.code)} />
                      <span>
                        <strong>{r.label}</strong>
                        <small>{r.hint}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="report-note">
                  <span>Note {reason === "other" ? "(needed)" : "(optional)"}</span>
                  <textarea value={note} maxLength={NOTE_MAX} rows={3} onChange={(e) => setNote(e.target.value)} disabled={busy} />
                  <small>
                    {note.length}/{NOTE_MAX}. Moderators see it with your wallet address
                  </small>
                </label>
                {error && (
                  <p className="tip-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="button" className="btn-gold report-send" onClick={() => void send()} disabled={busy} aria-busy={busy || undefined}>
                  {!wallet ? "Connect wallet to report" : busy ? "Sending…" : signed ? "Send report" : "Sign in and send"}
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
