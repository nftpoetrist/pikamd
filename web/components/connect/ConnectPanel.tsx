"use client";

import PageLink from "@/components/PageLink";
import { useId, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import CopyButton from "@/components/CopyButton";
import { useSavedSlugs, useSignedIn } from "@/lib/collection/client";
import { EXAMPLE_ASKS, KEY_PLACEHOLDER, MCP_TOOLS, agentPrompt, agentSetups, maskKey, mcpUrl, type AgentId } from "@/lib/mcp/connect";
import { useKeyActions, useMcpKey } from "@/lib/mcp/key-client";
import { useConnectedApps, useDisconnectApp } from "@/lib/oauth/apps-client";
import { useHydrated } from "@/lib/hydrated";
import { messageFor } from "@/lib/publish/client";
import { useWalletUnknown } from "@/lib/wallet/known";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSignIn } from "@/lib/wallet/session";

const noSubscribe = () => () => {};
const DAY = { month: "short", day: "numeric", year: "numeric" } as const;

/** "just now", "5 minutes ago", "3 days ago" */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  return rtf.format(-Math.floor(s / 86400), "day");
}

// Connect your agent (ARCHITECTURE §8, §8.1, §8.2). Two ways in: add the server address and sign
// in with the wallet when the agent asks (OAuth: claude.ai, Claude Desktop and mobile, Claude Code
// and other agents that support MCP sign-in), or create a key → paste one prompt into the agent,
// or set it up by hand → try it. Searching and reading need neither. Connected apps (from sign-in)
// are listed at the end, each with Disconnect.
export default function ConnectPanel() {
  // The server is this site's own /mcp route, so the URL follows whatever domain serves the page.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => null);
  const unknown = useWalletUnknown();
  const { wallet, signed, pending } = useSignedIn();
  const signIn = useSignIn();
  const keyInfo = useMcpKey();
  const actions = useKeyActions();
  const saved = useSavedSlugs();
  const hydrated = useHydrated();
  const apps = useConnectedApps();
  const disconnect = useDisconnectApp();
  const [dropping, setDropping] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentId>("claude-code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabsId = useId();

  // Everything but step 01 shows at once. Step 01 depends on the wallet, the session and the key,
  // which the server can't see: until they're known its row keeps its place. The MCP address
  // comes from this page's origin, known once the page runs in the browser; until then the boxes
  // that carry it keep their place too, so a wrong address never flashes.
  const checking = origin === null || unknown || (wallet !== null && pending) || (signed && keyInfo.isPending);
  const hideUntilKnown = (known: boolean) => (known ? undefined : ({ visibility: "hidden" } as const));

  const record = signed ? (keyInfo.data ?? null) : null;
  const url = mcpUrl(origin ?? "");
  // The full key exists only in this page's memory, right after it's created (shown once). If
  // another tab or device replaced or revoked it, the record no longer matches and it's hidden.
  const key = freshKey && record && record.masked === maskKey(freshKey) ? freshKey : null;
  const shownKey = key ?? KEY_PLACEHOLDER;
  const setups = agentSetups(url, shownKey);
  const active = setups.find((s) => s.id === agent) ?? setups[0];

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };
  const create = () => attempt(async () => setFreshKey(await actions.create()));
  const revoke = () =>
    attempt(async () => {
      await actions.revoke();
      setFreshKey(null);
    });
  const startSignIn = () =>
    attempt(async () => {
      if (!wallet) return;
      try {
        await signIn(wallet);
      } catch {
        throw new Error("You didn't sign in. Your key needs one free signature from your wallet");
      }
    });

  // Arrow keys move between agent tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = setups[(i + step + setups.length) % setups.length];
    setAgent(next.id);
    document.getElementById(`${tabsId}-tab-${next.id}`)?.focus();
  };

  const count = saved.state === "ready" ? saved.slugs.length : null;

  return (
    <section className="connect-panel pixel-panel" aria-label="Connect your agent">
      <p className="connect-intro">
        Searching and reading guidelines over MCP need nothing. To read your collection (<code>my_collection</code>), your agent signs in
        with your wallet, or uses a key
      </p>

      {/* Sign-in: no key to copy */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">★</span> Connect by signing in
        </h2>
        <p className="connect-text">
          Add PikaMd by its address. The first time your agent needs your collection, it opens PikaMd to sign in with your wallet: one free
          signature, no key to copy
        </p>
        <div className="pub-prompt-head">
          <p className="connect-where">Server address</p>
          <CopyButton text={url} />
        </div>
        <pre className="connect-code" style={hideUntilKnown(origin !== null)}>
          <code>{url}</code>
        </pre>
        <ul className="connect-notes">
          <li>
            claude.ai, Claude Desktop and mobile: Customize → Connectors → Add custom connector, paste the address. When Claude needs your
            collection it shows Connect
          </li>
          <li>
            Claude Code: <code>claude mcp add --transport http --scope user pikamd {url}</code>, then run <code>/mcp</code> to sign in when it
            asks
          </li>
          <li>Other agents that support MCP sign-in open the same screen. If yours doesn&apos;t, use a key below</li>
        </ul>
      </div>

      <p className="connect-or">Or use a key</p>

      {/* 01 Key */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">01</span> Create your key
        </h2>
        <p className="connect-text">
          One key links your agent to your wallet&apos;s collection. You&apos;ll see it only once, so copy it right away
        </p>

        {checking ? (
          <div className="connect-actions" aria-busy="true">
            <button type="button" className="btn-gold" disabled tabIndex={-1} aria-hidden="true" style={hideUntilKnown(false)}>
              Connect Wallet
            </button>
          </div>
        ) : !wallet ? (
          <div className="connect-actions">
            <button type="button" className="btn-gold" onClick={openWalletModal}>
              Connect Wallet
            </button>
            <p className="pub-hint">Your key belongs to your wallet. Connecting is free</p>
          </div>
        ) : !signed ? (
          <div className="connect-actions">
            <button type="button" className="btn-gold" onClick={() => void startSignIn()} disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Check your wallet…" : "Sign in"}
            </button>
            <p className="pub-hint">One free signature from your wallet, with no transaction and no gas</p>
          </div>
        ) : keyInfo.isError ? (
          <p className="pub-error" role="alert">
            Couldn&apos;t load your key: {messageFor(keyInfo.error)}
          </p>
        ) : key ? (
          <div className="connect-key">
            <code className="connect-key-value">{key}</code>
            <div className="connect-actions">
              <CopyButton text={key} label="Copy key" />
              <button type="button" className="pub-link" onClick={() => void revoke()} disabled={busy}>
                Revoke
              </button>
            </div>
            <p className="pub-hint is-warn">Copy it now. PikaMd keeps only a fingerprint of it, so it can&apos;t be shown again</p>
          </div>
        ) : record ? (
          <div className="connect-key">
            <p className="connect-key-meta">
              <code>{record.masked}</code> · created {new Date(record.createdAt).toLocaleDateString("en-US", DAY)} ·{" "}
              {record.lastUsedAt ? `last used by an agent ${ago(record.lastUsedAt)}` : "not used by an agent yet"}
            </p>
            <div className="connect-actions">
              <button type="button" className="btn-ghost" onClick={() => void create()} disabled={busy}>
                {busy ? "Working…" : "Create a new key"}
              </button>
              <button type="button" className="pub-link" onClick={() => void revoke()} disabled={busy}>
                Revoke
              </button>
            </div>
            <p className="pub-hint">A new key replaces this one, and agents using the old key lose access</p>
          </div>
        ) : (
          <div className="connect-actions">
            <button type="button" className="btn-gold" onClick={() => void create()} disabled={busy}>
              {busy ? "Working…" : "Create key"}
            </button>
          </div>
        )}
        {error && (
          <p className="pub-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* 02 One prompt for any agent */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">02</span> Paste this into your agent
        </h2>
        <p className="connect-text">Most agents can add PikaMd to their own settings. If yours can&apos;t, it shows you the steps</p>
        <div className="pub-prompt">
          <div className="pub-prompt-head">
            <p className="pub-prompt-title">Prompt for your agent</p>
            <CopyButton text={agentPrompt(url, shownKey)} label="Copy prompt" disabled={!key} />
          </div>
          {/* Scrolls inside its box (people copy it more than read it); focusable so keyboards can scroll it */}
          <pre className="pub-prompt-text connect-prompt-text" tabIndex={0} aria-label="Prompt for your agent" style={hideUntilKnown(origin !== null)}>
            {agentPrompt(url, shownKey)}
          </pre>
          <p className={key ? "pub-hint" : "pub-hint is-warn"} style={hideUntilKnown(!checking)}>
            {key
              ? "Your key is part of this prompt, so it stays in your agent's chat history. Prefer to keep it out? Use the manual setup below"
              : record
                ? "Your key is shown only once. Create a new key and it fills in here"
                : "Create your key first and it fills in here"}
          </p>
        </div>
      </div>

      {/* 03 Manual setup per agent */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">03</span> Or set it up yourself
        </h2>
        <div className="connect-tabs" role="tablist" aria-label="Agent">
          {setups.map((s, i) => (
            <button
              key={s.id}
              id={`${tabsId}-tab-${s.id}`}
              type="button"
              role="tab"
              aria-selected={s.id === active.id}
              aria-controls={`${tabsId}-panel`}
              tabIndex={s.id === active.id ? 0 : -1}
              onClick={() => setAgent(s.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div id={`${tabsId}-panel`} className="connect-setup" role="tabpanel" aria-labelledby={`${tabsId}-tab-${active.id}`}>
          <div className="pub-prompt-head">
            <p className="connect-where">{active.where}</p>
            <CopyButton text={active.snippet} />
          </div>
          <pre className="connect-code" style={hideUntilKnown(origin !== null)}>
            <code>{active.snippet}</code>
          </pre>
          <ul className="connect-notes">
            {active.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {!key && <p className="pub-hint is-warn">Replace {KEY_PLACEHOLDER} with your key</p>}
        </div>
      </div>

      {/* 04 Try it */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">04</span> Ask your agent
        </h2>
        <ul className="connect-asks">
          {EXAMPLE_ASKS.map((ask) => (
            <li key={ask}>
              <span aria-hidden="true">&gt; </span>
              {ask}
            </li>
          ))}
        </ul>
        <div className="connect-tools">
          <p className="connect-tools-title">Tools your agent gets</p>
          <dl>
            {MCP_TOOLS.map((t) => (
              <div key={t.name}>
                <dt>
                  <code>{t.name}</code>
                </dt>
                <dd>{t.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="connect-text">
          {count === null ? (
            <>
              Your agent sees the guidelines you save with your wallet. <PageLink href="/explore">Find some on Explore</PageLink>
            </>
          ) : count > 0 ? (
            <>
              Your agent will see the <PageLink href="/collection">{count} guideline{count === 1 ? "" : "s"} in your collection</PageLink>
            </>
          ) : (
            <>
              Your collection is empty. <PageLink href="/explore">Add guidelines on Explore</PageLink> and your agent will see them
            </>
          )}
        </p>
      </div>

      {/* Connected apps: agents this wallet allowed through sign-in. Only after hydration: the server
          can't see the wallet, so the first render must match its HTML */}
      {hydrated && signed && (
        <div className="connect-step">
          <h2 className="connect-step-title">
            <span aria-hidden="true">★</span> Connected apps
          </h2>
          {apps.isPending ? (
            <p className="connect-text" aria-busy="true">
              Loading…
            </p>
          ) : apps.isError ? (
            <p className="pub-error" role="alert">
              Couldn&apos;t load your connected apps: {messageFor(apps.error)}
            </p>
          ) : apps.data.length === 0 ? (
            <p className="connect-text">No app has signed in with this wallet yet</p>
          ) : (
            <ul className="connect-apps">
              {apps.data.map((a) => (
                <li key={a.id}>
                  <div>
                    <p className="connect-app-name">
                      {a.host ?? a.name}
                      {a.kind === "dcr" && <span className="connect-app-flag">Unverified</span>}
                    </p>
                    <p className="connect-app-meta">
                      {a.host ? `${a.name} · ` : ""}connected {new Date(a.createdAt).toLocaleDateString("en-US", DAY)} ·{" "}
                      {a.lastUsedAt ? `last used ${ago(a.lastUsedAt)}` : "not used yet"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pub-link"
                    disabled={dropping !== null}
                    onClick={() =>
                      void (async () => {
                        setDropping(a.id);
                        setError(null);
                        try {
                          await disconnect(a.id);
                        } catch (e) {
                          setError(messageFor(e));
                        } finally {
                          setDropping(null);
                        }
                      })()
                    }
                  >
                    {dropping === a.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="pub-hint">Disconnecting stops the app at once. It can ask you to sign in again later</p>
        </div>
      )}
    </section>
  );
}
