"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import CopyButton from "@/components/CopyButton";
import { useCollection } from "@/lib/collection/store";
import {
  EXAMPLE_ASKS,
  KEY_PLACEHOLDER,
  MCP_TOOLS,
  agentPrompt,
  agentSetups,
  createKey,
  hashKey,
  maskKey,
  mcpUrl,
  type AgentId,
} from "@/lib/mcp/connect";
import { revokeKeyRecord, saveKeyRecord, useKeyRecord } from "@/lib/mcp/key-store";
import { MOCK_SERVER, registerKeyHash, revokeKeyOnServer, syncCollection } from "@/lib/mcp/mock-sync";

const noSubscribe = () => () => {};

// Connect your agent (ARCHITECTURE §8, §8.1): create a key → paste one prompt into your agent,
// or set it up by hand per agent → try it. Developers on their own machine come first (K11).
export default function ConnectPanel() {
  // The server is this site's own /mcp route, so the URL follows whatever domain serves the page.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => null);
  const record = useKeyRecord();
  const collected = useCollection();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentId>("claude-code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabsId = useId();

  // Local preview: make sure the MCP server sees the same collection this browser shows.
  useEffect(() => {
    if (collected) syncCollection(collected);
  }, [collected]);

  // Nothing until hydrated: the server sees neither the origin nor this browser's key record.
  if (origin === null || record === null) {
    return <section className="connect-panel pixel-panel" aria-label="Connect your agent" aria-busy="true" />;
  }

  const url = mcpUrl(origin);
  // The full key exists only in this page's memory, right after it's created (shown once).
  // If another tab revoked or replaced it, the record no longer matches and it's hidden too.
  const key = freshKey && record && record.masked === maskKey(freshKey) ? freshKey : null;
  const shownKey = key ?? KEY_PLACEHOLDER;
  const setups = agentSetups(url, shownKey);
  const active = setups.find((s) => s.id === agent) ?? setups[0];

  // The server gets only the key's SHA-256; the key is shown here once and kept nowhere.
  const create = async () => {
    setBusy(true);
    setError(null);
    const k = createKey();
    const stored = await registerKeyHash(await hashKey(k), collected ?? []);
    setBusy(false);
    if (!stored) {
      setError("The key couldn't be saved on the server, so it wouldn't work. Check that the site is running and try again.");
      return;
    }
    setFreshKey(k);
    saveKeyRecord({ masked: maskKey(k), createdAt: new Date().toISOString() });
  };

  const revoke = async () => {
    setBusy(true);
    setError(null);
    const done = await revokeKeyOnServer();
    setBusy(false);
    if (!done) {
      setError("The key couldn't be revoked on the server. Try again.");
      return;
    }
    setFreshKey(null);
    revokeKeyRecord();
  };

  // Arrow keys move between agent tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = setups[(i + step + setups.length) % setups.length];
    setAgent(next.id);
    document.getElementById(`${tabsId}-tab-${next.id}`)?.focus();
  };

  const createdOn = record
    ? new Date(record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <section className="connect-panel pixel-panel" aria-label="Connect your agent">
      {MOCK_SERVER ? (
        <p className="pub-demo">
          <strong>Local preview.</strong> The MCP server runs on this computer with sample guidelines. Keys and
          collections aren&apos;t linked to wallets yet, so there&apos;s one key and one collection, stored for this computer only
        </p>
      ) : (
        <p className="pub-demo">
          <strong>Demo mode.</strong> The PikaMd MCP server and wallet sign-in aren&apos;t live yet. Keys made here are
          samples created in your browser and won&apos;t connect to anything until launch
        </p>
      )}

      {/* 01 Key */}
      <div className="connect-step">
        <h2 className="connect-step-title">
          <span aria-hidden="true">01</span> Create your key
        </h2>
        <p className="connect-text">
          One key links your agent to your collection. You&apos;ll see it only once, so copy it right away
        </p>

        {key ? (
          <div className="connect-key">
            <code className="connect-key-value">{key}</code>
            <div className="connect-actions">
              <CopyButton text={key} label="Copy key" />
              <button type="button" className="pub-link" onClick={revoke} disabled={busy}>
                Revoke
              </button>
            </div>
            <p className="pub-hint is-warn">Copy it now. Once you leave this page, only its first and last characters stay visible</p>
          </div>
        ) : record ? (
          <div className="connect-key">
            <p className="connect-key-meta">
              <code>{record.masked}</code> · created {createdOn}
            </p>
            <div className="connect-actions">
              <button type="button" className="btn-ghost" onClick={create} disabled={busy}>
                {busy ? "Working…" : "Create a new key"}
              </button>
              <button type="button" className="pub-link" onClick={revoke} disabled={busy}>
                Revoke
              </button>
            </div>
            <p className="pub-hint">A new key replaces this one, and agents using the old key lose access</p>
          </div>
        ) : (
          <div className="connect-actions">
            <button type="button" className="btn-gold" onClick={create} disabled={busy}>
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
          <pre className="pub-prompt-text connect-prompt-text" tabIndex={0} aria-label="Prompt for your agent">
            {agentPrompt(url, shownKey)}
          </pre>
          <p className={key ? "pub-hint" : "pub-hint is-warn"}>
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
          <pre className="connect-code">
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
          {collected && collected.length > 0 ? (
            <>
              Your agent will see the <Link href="/collection">{collected.length} guideline{collected.length === 1 ? "" : "s"} in your collection</Link>
            </>
          ) : (
            <>
              Your collection is empty. <Link href="/explore">Add guidelines on Explore</Link> and your agent will see them
            </>
          )}
        </p>
      </div>
    </section>
  );
}
