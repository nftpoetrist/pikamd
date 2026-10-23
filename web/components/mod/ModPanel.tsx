"use client";

import PageLink from "@/components/PageLink";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ReviewedMark from "@/components/ReviewedMark";
import { shortAddress } from "@/components/md-format";
import { REVIEWS } from "@/lib/chain";
import { scanGuideline } from "@/lib/scan";
import type { Guideline } from "@/lib/types";
import { api } from "@/lib/wallet/api";
import { useSignedIn } from "@/lib/collection/client";
import { useIsModerator, useModActions, useModQueue, type QueueItem, type ReviewItem } from "@/lib/moderation/client";
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

  const { reported, flagged, locked, review } = queue.data;
  return (
    <section className="mod-panel pixel-panel" aria-label="Moderation">
      <ModSection title="Reports" empty="No open reports" items={reported} />
      <ModSection title="Flagged by the scan" empty="Nothing flagged" hint="Not served to agents until you approve them" items={flagged} />
      <ModSection title="Locked" empty="Nothing locked" hint="Off Explore, search and MCP. Remove the file from IPFS once you're sure" items={locked} />
      <LiveSections review={review} />
    </section>
  );
}

// Every guideline on the site, findable: read it, approve it (the Reviewed badge), take an
// approval back, or lock a harmful one, reported or not.
function LiveSections({ review }: { review: ReviewItem[] }) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase().replace(/^#/, "");
  const shown = q ? review.filter((g) => [g.title, g.slug, String(g.id), g.author].some((v) => v.toLowerCase().includes(q))) : review;
  return (
    <>
      <div className="mod-section">
        <h2>
          On the site <span>{review.length}</span>
        </h2>
        <p className="mod-hint">
          Lock a harmful guideline on Arc and it leaves Explore, search, its page and agents at once; then remove its file from IPFS under Locked.
          The record on Arc stays: nothing on a blockchain can be deleted
        </p>
        <input
          className="mod-filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find by title, name, #id or author address"
          aria-label="Find a guideline"
        />
      </div>
      <ReviewSection
        title={REVIEWS ? "Waiting for review" : "Live guidelines"}
        empty={q ? "Nothing matches" : REVIEWS ? "Every listed guideline is reviewed" : "Nothing listed"}
        hint={REVIEWS ? "Read the file, then approve that exact version on Arc: it gets the Reviewed badge" : undefined}
        items={shown.filter((g) => !REVIEWS || !g.reviewed)}
      />
      {REVIEWS && (
        <ReviewSection
          title="Reviewed"
          empty={q ? "Nothing matches" : "Nothing reviewed yet"}
          hint="Take an approval back if a file turns out to be unsafe, or lock it"
          items={shown.filter((g) => g.reviewed)}
        />
      )}
    </>
  );
}

function ReviewSection({ title, empty, hint, items }: { title: string; empty: string; hint?: string; items: ReviewItem[] }) {
  return (
    <div className="mod-section">
      <h2>
        {title} <span>{items.length}</span>
      </h2>
      {hint && <p className="mod-hint">{hint}</p>}
      {items.length === 0 ? <p className="mod-empty">{empty}</p> : items.map((g) => <ReviewRow key={g.id} g={g} />)}
    </div>
  );
}

// One guideline to review: the file is read here, as agents get it, with what the site hides
// listed first. Approve stays off until the file was opened: a review means someone read it.
function ReviewRow({ g }: { g: ReviewItem }) {
  const { setReview, setLock } = useModActions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"review" | "lock" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const file = useQuery({
    queryKey: ["guideline", g.slug],
    queryFn: () => api<Guideline>(`/api/guidelines/${encodeURIComponent(g.slug)}`),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });
  const content = open && file.data?.slug === g.slug ? file.data.content : null;
  const attention = content === null ? [] : scanGuideline(content).findings.filter((f) => f.severity === "review");

  const run = async (kind: "review" | "lock", work: () => Promise<void>) => {
    setBusy(kind);
    setNote(null);
    try {
      await work();
    } catch (e) {
      setNote(messageFor(e));
    } finally {
      setBusy(null);
    }
  };
  const lock = () => {
    if (!window.confirm(`Lock "${g.title}" on Arc? It leaves Explore, search, its page and agents at once. You can unlock it later under Locked.`)) return;
    void run("lock", () => setLock(g.id, true));
  };

  return (
    <article className="mod-row">
      <header>
        <PageLink href={`/g/${g.slug}`} prefetch className="mod-title">
          {g.title}
        </PageLink>
        <span className="mod-meta">
          #{g.id} · v{g.version} · by {shortAddress(g.author)}
          {g.flagged && <em className="mod-badge is-flagged">FLAGGED</em>}
          {g.reviewed && <ReviewedMark />}
        </span>
      </header>

      {open && (
        <div className="mod-review">
          {file.isError ? (
            <p className="pub-error" role="alert">
              Couldn&apos;t load the file: {messageFor(file.error)}
            </p>
          ) : content === null ? (
            <p className="mod-empty">Loading the file…</p>
          ) : (
            <>
              {attention.length > 0 ? (
                <ul className="mod-attention" aria-label="Lines to check">
                  {attention.map((f) => (
                    <li key={f.id}>
                      Line {f.line}: {f.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mod-hint">Nothing hidden from readers and nothing the scan flags. Still, read it all</p>
              )}
              <pre className="mod-file" tabIndex={0} aria-label={`${g.slug}.md as agents get it`}>
                {content.split("\n").map((line, i) => (
                  <span key={i} className={attention.some((f) => f.line === i + 1) ? "is-hit" : undefined}>
                    <i aria-hidden="true">{i + 1}</i>
                    {line}
                    {"\n"}
                  </span>
                ))}
              </pre>
            </>
          )}
        </div>
      )}

      <div className="mod-actions">
        <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Close the file" : "Read the file"}
        </button>
        {REVIEWS &&
          (g.reviewed ? (
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => void run("review", () => setReview(g.id, g.version, false))}>
              {busy === "review" ? "Check your wallet…" : "Revoke approval on Arc"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-gold"
              disabled={!!busy || content === null || g.flagged}
              title={g.flagged ? "Approve it for agents first (Flagged by the scan)" : content === null ? "Read the file first" : undefined}
              onClick={() => void run("review", () => setReview(g.id, g.version, true))}
            >
              {busy === "review" ? "Check your wallet…" : `Approve v${g.version} on Arc`}
            </button>
          ))}
        <button type="button" className="btn-gold mod-lock" disabled={!!busy} onClick={lock}>
          {busy === "lock" ? "Check your wallet…" : "Lock on Arc"}
        </button>
      </div>
      {REVIEWS && g.flagged && !g.reviewed && <p className="mod-hint">Flagged by the scan: approve it for agents above before reviewing it</p>}
      {note && (
        <p className="mod-note" role="status">
          {note}
        </p>
      )}
    </article>
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
        <PageLink href={`/g/${g.slug}`} prefetch className="mod-title">
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
