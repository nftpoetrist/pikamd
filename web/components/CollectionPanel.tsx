"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type KeyboardEvent } from "react";
import { useConnection } from "wagmi";
import MdCard from "@/components/MdCard";
import { useCollection } from "@/lib/collection/store";
import { VISIBILITY_PHASES, useSharedList, useVisibility, type SharedList } from "@/lib/owned/client";
import type { GuidelineCard, OwnedGuideline } from "@/lib/types";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSignIn } from "@/lib/wallet/session";

type Tab = "saved" | "shared";
const TABS: { tab: Tab; label: string }[] = [
  { tab: "saved", label: "Saved" },
  { tab: "shared", label: "Shared by me" },
];

// My Collection shelf, two tabs: the guidelines saved on Explore, and the ones this wallet shared
// (with Hide / Show again). The tab is in the URL (?tab=shared), read on the client: Suspense keeps
// the rest of the page prerendered, the fallback is the same shelf on its first tab.
export default function CollectionPanel({ guidelines }: { guidelines: GuidelineCard[] }) {
  return (
    <Suspense fallback={<Shelf guidelines={guidelines} tab="saved" />}>
      <ShelfFromUrl guidelines={guidelines} />
    </Suspense>
  );
}

function ShelfFromUrl({ guidelines }: { guidelines: GuidelineCard[] }) {
  const [tab, setTab] = useState<Tab>(useSearchParams().get("tab") === "shared" ? "shared" : "saved");
  const select = (next: Tab) => {
    setTab(next);
    // Shareable link without a history entry per click
    const url = `${window.location.pathname}${next === "shared" ? "?tab=shared" : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
  };
  return <Shelf guidelines={guidelines} tab={tab} onTab={select} />;
}

function Shelf({ guidelines, tab, onTab }: { guidelines: GuidelineCard[]; tab: Tab; onTab?: (tab: Tab) => void }) {
  const slugs = useCollection();
  const shared = useSharedList(guidelines);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const bySlug = new Map(guidelines.map((g) => [g.slug, g]));
  const saved = (slugs ?? []).flatMap((slug) => bySlug.get(slug) ?? []);
  const counts: Record<Tab, string> = {
    saved: slugs === null ? "–" : String(saved.length),
    shared: "guidelines" in shared ? String(shared.guidelines.length) : "–",
  };

  // WAI-ARIA tabs: arrow keys move between the two tabs
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onTab?.(TABS[next].tab);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="collection-panel pixel-panel" aria-label="My collection">
      <header className="collection-head">
        <div className="collection-tabs" role="tablist" aria-label="My collection">
          {TABS.map(({ tab: t, label }, i) => (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`collection-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`collection-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              className={tab === t ? "btn-gold collection-tab" : "btn-ghost collection-tab"}
              onClick={() => onTab?.(t)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {label}
              <span className="collection-count" aria-label={`${counts[t]} guidelines`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        <Link href="/connect" className="btn-ghost">
          Connect your agent
        </Link>
      </header>

      <div role="tabpanel" id={`collection-panel-${tab}`} aria-labelledby={`collection-tab-${tab}`}>
        {tab === "saved" ? <SavedShelf slugs={slugs} saved={saved} /> : <SharedShelf shared={shared} />}
      </div>
    </section>
  );
}

function SavedShelf({ slugs, saved }: { slugs: readonly string[] | null; saved: GuidelineCard[] }) {
  // Nothing until hydrated: the server can't see what this browser saved.
  if (slugs === null) return null;
  if (saved.length === 0) {
    return (
      <div className="collection-empty">
        <p className="collection-empty-title">Your library is empty.</p>
        <p className="collection-empty-text">
          Find a guideline on Explore and press <span>+ Add to collection</span>.
        </p>
        <Link href="/explore" className="btn-gold">
          Explore guidelines
        </Link>
      </div>
    );
  }
  return (
    <div className="collection-grid">
      {saved.map((g) => (
        <MdCard key={g.id} guideline={g} />
      ))}
    </div>
  );
}

function SharedShelf({ shared }: { shared: SharedList }) {
  const signIn = useSignIn();
  const { address } = useConnection();
  const [signError, setSignError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  if (shared.mode === "loading") return null;
  if (shared.mode === "disconnected") {
    return (
      <div className="collection-empty">
        <p className="collection-empty-title">See what you&apos;ve shared</p>
        <p className="collection-empty-text">Connect your wallet to see the guidelines you published.</p>
        <button type="button" className="btn-gold" onClick={openWalletModal}>
          Connect Wallet
        </button>
      </div>
    );
  }
  const { mode, guidelines, signedIn, error } = shared;

  const startSignIn = async () => {
    if (!address || signing) return;
    setSignError(null);
    setSigning(true);
    try {
      await signIn(address);
    } catch {
      setSignError("You didn't sign in. Hidden guidelines stay out of this list until you do");
    } finally {
      setSigning(false);
    }
  };

  return (
    <>
      <p className="shared-note">
        Hide takes a guideline off Explore, search and MCP. Its record on Arc and its file on IPFS stay, and you can show it again any
        time. Each change is a small Arc transaction from your wallet
      </p>
      {!signedIn && (
        <div className="shared-signin">
          <span>Guidelines you hid show up here after you sign in with your wallet (one free signature)</span>
          <button type="button" className="btn-ghost" disabled={signing} aria-busy={signing || undefined} onClick={() => void startSignIn()}>
            {signing ? "Check your wallet…" : "Sign in"}
          </button>
        </div>
      )}
      {(error || signError) && (
        <p className="shared-error" role="alert">
          {signError ?? error}
        </p>
      )}

      {guidelines.length === 0 ? (
        <div className="collection-empty">
          <p className="collection-empty-title">{mode === "signed" ? "You haven't shared a guideline yet." : "Nothing listed from this wallet."}</p>
          <p className="collection-empty-text">Share one with the community and it shows up here.</p>
          <Link href="/new" className="btn-gold">
            Publish a guideline
          </Link>
        </div>
      ) : (
        <div className="collection-grid">
          {guidelines.map((g) => (
            <SharedItem key={g.id} guideline={g} />
          ))}
        </div>
      )}
    </>
  );
}

function statusText(g: OwnedGuideline): string {
  if (g.hidden && g.locked) return "Hidden, and locked by a moderator";
  if (g.hidden) return "Hidden: not on Explore, search or MCP";
  if (g.locked) return "Locked by a moderator: off PikaMd";
  if (g.flagged) return "On Explore. Agents get it once a moderator checks it";
  return "On Explore, search and MCP";
}

function SharedItem({ guideline: g }: { guideline: OwnedGuideline }) {
  const { phase, busy, error, pendingTx, run } = useVisibility();
  const off = g.hidden || g.locked;
  const action = g.hidden ? "Show again" : "Hide";
  const label = busy ? VISIBILITY_PHASES[phase] : pendingTx ? "Try again" : action;

  return (
    <div className="shared-item">
      {/* Off-site guidelines can't be opened, liked or collected: shown dimmed and inert */}
      {off ? (
        <div className="shared-off" inert>
          <MdCard guideline={g} focusable={false} />
        </div>
      ) : (
        <MdCard guideline={g} />
      )}
      <div className="shared-bar">
        <span className={off ? "shared-status is-off" : "shared-status"}>{statusText(g)}</span>
        <button
          type="button"
          className={g.hidden ? "btn-gold" : "btn-ghost"}
          disabled={busy}
          aria-busy={busy || undefined}
          aria-label={busy ? `${label} ${g.title}` : `${pendingTx ? "Finish: " + action : action} ${g.title}`}
          onClick={() => void run(g.id, !g.hidden)}
        >
          {label}
        </button>
      </div>
      {error && (
        <p className="shared-error" role="alert">
          {error}
          {pendingTx ? ". Your change is on Arc; press Try again to update PikaMd" : ""}
        </p>
      )}
    </div>
  );
}
