"use client";

import PageLink from "@/components/PageLink";
import { useState } from "react";
import { shortAddress } from "@/components/md-format";
import { useSignedIn } from "@/lib/collection/client";
import { useIsModerator, useModActions, useModQueue, type QueueItem } from "@/lib/moderation/client";
import { reasonLabel } from "@/lib/moderation/reasons";
import { messageFor } from "@/lib/publish/client";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSignIn } from "@/lib/wallet/session";
import { useHydrated } from "@/lib/hydrated";

const DAY = { month: "short", day: "numeric" } as const;

// The moderation desk: who may use it is decided on Arc (MODERATOR_ROLE), every action is logged.
export default function ModPanel() {
  const hydrated = useHydrated();
  const { wallet, signed, pending } = useSignedIn();
  const signIn = useSignIn();
  const role = useIsModerator();
  const queue = useModQueue(signed && role.data === true);
  const [signing, setSigning] = useState(false);

  const gate = (title: string, text: string, action?: { label: string; run: () => void }) => (
    <section className="mod-panel pixel-panel">
      <div className="collection-empty">
        <p className="collection-empty-title">{title}</p>
        <p className="collection-empty-text">{text}</p>
        {action && (
          <button type="button" className="btn-gold" onClick={action.run} disabled={signing}>
            {action.label}
          </button>
        )}
      </div>
    </section>
  );

  if (!hydrated || pending) return <section className="mod-panel pixel-panel" aria-busy="true" />;
  if (!wallet) return gate("Moderators only", "Connect the wallet that holds the moderator role on Arc.", { label: "Connect Wallet", run: openWalletModal });
  if (!signed)
    return gate("Sign in to moderate", "One free signature, so the server knows it's your wallet.", {
      label: signing ? "Check your wallet…" : "Sign in",
      run: () => {
        setSigning(true);
        void signIn(wallet).catch(() => {}).finally(() => setSigning(false));
      },
    });
  if (role.isPending) return <section className="mod-panel pixel-panel" aria-busy="true" />;
  if (role.isError) return gate("Couldn't check your role", messageFor(role.error));
  if (!role.data) return gate("This wallet isn't a moderator", `${shortAddress(wallet)} doesn't hold MODERATOR_ROLE in the registry on Arc.`);
  if (queue.isError) return gate("Couldn't load the queue", messageFor(queue.error));
  if (!queue.data) return <section className="mod-panel pixel-panel" aria-busy="true" />;

  const { reported, flagged, locked } = queue.data;
  return (
    <section className="mod-panel pixel-panel" aria-label="Moderation">
      <ModSection title="Reports" empty="No open reports" items={reported} />
      <ModSection title="Flagged by the scan" empty="Nothing flagged" hint="Not served to agents until you approve them" items={flagged} />
      <ModSection title="Locked" empty="Nothing locked" hint="Off Explore, search and MCP. Remove the file from IPFS once you're sure" items={locked} />
    </section>
  );
}

function ModSection({ title, empty, hint, items }: { title: string; empty: string; hint?: string; items: QueueItem[] }) {
  return (
    <div className="mod-section">
      <h2>
        {title} <span>{items.length}</span>
      </h2>
      {hint && <p className="mod-hint">{hint}</p>}
      {items.length === 0 ? <p className="mod-empty">{empty}</p> : items.map((g) => <ModRow key={g.id} g={g} />)}
    </div>
  );
}

function ModRow({ g }: { g: QueueItem }) {
  const { setLock, act } = useModActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (label: string, work: () => Promise<string | void>) => {
    setBusy(label);
    setNote(null);
    try {
      const msg = await work();
      if (msg) setNote(msg);
    } catch (e) {
      setNote(messageFor(e));
    } finally {
      setBusy(null);
    }
  };
  const counts = new Map<string, number>();
  for (const r of g.reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);

  return (
    <article className="mod-row">
      <header>
        <PageLink href={`/g/${g.slug}`} className="mod-title">
          {g.title}
        </PageLink>
        <span className="mod-meta">
          #{g.id} · by {shortAddress(g.author)}
          {g.locked && <em className="mod-badge is-locked">LOCKED</em>}
          {g.hidden && <em className="mod-badge">HIDDEN</em>}
          {g.flagged && <em className="mod-badge is-flagged">FLAGGED</em>}
        </span>
      </header>
      {g.reports.length > 0 && (
        <>
          <p className="mod-reasons">
            {[...counts].map(([r, n]) => (
              <span key={r}>
                {reasonLabel(r)} ×{n}
              </span>
            ))}
          </p>
          <ul className="mod-notes">
            {g.reports
              .filter((r) => r.note)
              .map((r) => (
                <li key={r.reporter + r.at}>
                  “{r.note}” <span>— {shortAddress(r.reporter)}, {new Date(r.at).toLocaleDateString("en-US", DAY)}</span>
                </li>
              ))}
          </ul>
        </>
      )}
      <div className="mod-actions">
        {g.locked ? (
          <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => void run("unlock", () => setLock(g.id, false))}>
            {busy === "unlock" ? "Check your wallet…" : "Unlock on Arc"}
          </button>
        ) : (
          <button type="button" className="btn-gold mod-lock" disabled={!!busy} onClick={() => void run("lock", () => setLock(g.id, true))}>
            {busy === "lock" ? "Check your wallet…" : "Lock on Arc"}
          </button>
        )}
        {g.reports.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => void run("dismiss", async () => `${(await act(g.id, "dismiss")).dismissed} report(s) dismissed`)}
          >
            {busy === "dismiss" ? "Working…" : "Dismiss reports"}
          </button>
        )}
        {g.flagged && !g.locked && (
          <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => void run("approve", async () => void (await act(g.id, "approve")))}>
            {busy === "approve" ? "Working…" : "Approve for agents"}
          </button>
        )}
        {g.locked && g.pinned && (
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() =>
              void run("unpin", async () => {
                const n = Number((await act(g.id, "unpin")).unpinned);
                return n > 0 ? `Removed ${n} file(s) from our IPFS pins` : "Kept: another guideline or upload still uses this file";
              })
            }
          >
            {busy === "unpin" ? "Working…" : "Remove file from IPFS"}
          </button>
        )}
      </div>
      {note && (
        <p className="mod-note" role="status">
          {note}
        </p>
      )}
    </article>
  );
}
