"use client";

import PageLink from "@/components/PageLink";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type KeyboardEvent } from "react";
import { useConnection } from "wagmi";
import MdCard from "@/components/MdCard";
import { useSavedSlugs, type Saved } from "@/lib/collection/client";
import { useSharedList, type SharedList } from "@/lib/owned/client";
import { messageFor } from "@/lib/publish/client";
import type { GuidelineCard } from "@/lib/types";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSignIn } from "@/lib/wallet/session";

type Tab = "saved" | "shared";
const TABS: { tab: Tab; label: string }[] = [
  { tab: "saved", label: "Saved" },
  { tab: "shared", label: "Shared by me" },
];

// My Collection shelf, two tabs: the guidelines this wallet saved (K12: on the server, the list its
// MCP key opens), and the ones this wallet shared
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
  const savedList = useSavedSlugs();
  const shared = useSharedList(guidelines);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const bySlug = new Map(guidelines.map((g) => [g.slug, g]));
  const saved = savedList.state === "ready" ? savedList.slugs.flatMap((slug) => bySlug.get(slug) ?? []) : [];
  const counts: Record<Tab, string> = {
    saved: savedList.state === "ready" ? String(saved.length) : "–",
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
        <PageLink href="/connect" className="btn-ghost">
          Connect your agent
        </PageLink>
      </header>

      <div role="tabpanel" id={`collection-panel-${tab}`} aria-labelledby={`collection-tab-${tab}`}>
        {tab === "saved" ? <SavedShelf list={savedList} saved={saved} /> : <SharedShelf shared={shared} />}
      </div>
    </section>
  );
}

function SavedShelf({ list, saved }: { list: Saved; saved: GuidelineCard[] }) {
  const signIn = useSignIn();
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  if (list.state === "loading") return null;
  if (list.state === "disconnected") {
    return (
      <div className="collection-empty">
        <p className="collection-empty-title">Your library lives in your wallet</p>
        <p className="collection-empty-text">Connect it to see the guidelines you saved, on any device. Your agent reads the same list over MCP.</p>
        <button type="button" className="btn-gold" onClick={openWalletModal}>
          Connect Wallet
        </button>
      </div>
    );
  }
  if (list.state === "signed-out") {
    const start = async () => {
      if (signing) return;
      setSignError(null);
      setSigning(true);
      try {
        await signIn(list.wallet);
      } catch {
        setSignError("You didn't sign in, so your saved guidelines stay hidden here");
      } finally {
        setSigning(false);
      }
    };
    return (
      <div className="collection-empty">
        <p className="collection-empty-title">Sign in to open your library</p>
        <p className="collection-empty-text">One free signature from your wallet, with no transaction and no gas.</p>
        <button type="button" className="btn-gold" disabled={signing} aria-busy={signing || undefined} onClick={() => void start()}>
          {signing ? "Check your wallet…" : "Sign in"}
        </button>
        {signError && (
          <p className="shared-error" role="alert">
            {signError}
          </p>
        )}
      </div>
    );
  }
  if (list.state === "error") {
    return (
      <p className="shared-error" role="alert">
        Couldn&apos;t load your collection: {messageFor(list.error)}
      </p>
    );
  }
  if (saved.length === 0) {
    return (
      <div className="collection-empty">
        <p className="collection-empty-title">Your library is empty.</p>
        <p className="collection-empty-text">
          Find a guideline on Explore and press <span>+ Add to collection</span>.
        </p>
        <PageLink href="/explore" className="btn-gold">
          Explore guidelines
        </PageLink>
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
          <PageLink href="/new" className="btn-gold">
            Publish a guideline
          </PageLink>
        </div>
      ) : (
        <div className="collection-grid">
          {guidelines.map((g) => (
            <MdCard key={g.id} guideline={g} />
          ))}
        </div>
      )}
    </>
  );
}
