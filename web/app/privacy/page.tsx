import type { Metadata } from "next";
import type { ReactNode } from "react";
import PageLink from "@/components/PageLink";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Privacy · PikaMd",
  description: "What PikaMd stores, what it doesn't, what is public on Arc and IPFS, and how to remove your data.",
};

// Privacy policy (2026-10-25, for the Connectors Directory listing and for everyone). Every
// statement comes from the code: web/supabase/migrations (tables and retention), lib/auth/session.ts
// (the one cookie), lib/query-persist.ts and lib/publish/draft.ts (browser storage),
// lib/server/ratelimit.ts (IPs are HMAC'd), next.config.ts (the outside hosts the browser talks to).
// Change it when any of those change. Styled with the docs page's classes.

const UPDATED = "October 26, 2026";
const ISSUES = "https://github.com/nftpoetrist/pikamd/issues";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="docs-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high hero-compact docs-page">
          <h1 className="hero-title">
            Privacy
            <br />
            <span>what PikaMd keeps</span>
          </h1>
          <p className="hero-sub">
            <span>No accounts, no email, no analytics, no ads</span> <span>Your wallet address is the only thing that identifies you</span>
          </p>

          <article className="docs-body pixel-panel privacy-body">
            <p className="docs-eyebrow">Last updated {UPDATED}</p>

            <Section id="summary" title="In short">
              <ul className="docs-list">
                <li>Reading PikaMd needs no account. When you only read, PikaMd stores nothing about you (its host processes requests like any website host, below).</li>
                <li>
                  When you connect a wallet, PikaMd knows its public address. It never asks for your name, email, phone number or any other
                  personal detail.
                </li>
                <li>There are no analytics, tracking pixels or advertising scripts, and PikaMd doesn&apos;t sell or share data for advertising.</li>
                <li>What you publish is public and permanent on Arc and IPFS. Read the clean-up step before you publish.</li>
              </ul>
            </Section>

            <Section id="collect" title="What PikaMd stores">
              <Table
                head={["What", "When", "Why"]}
                rows={[
                  [<b key="w">Wallet address</b>, "You connect a wallet and sign in", "Your session, likes, collection, guidelines, tips and connected apps belong to it"],
                  [<b key="w">Likes and collection</b>, "You like or save a guideline", "To show your likes and give your agent your saved guidelines"],
                  [
                    <b key="w">Published guidelines</b>,
                    "You publish",
                    "Title, summary, tags and the file, plus the scan result, so the library can show and search it",
                  ],
                  [<b key="w">Reports</b>, "You report a guideline", "The reason and the optional note you write, so a moderator can review it"],
                  [<b key="w">Tips</b>, "You send a tip", "The public Arc transaction, so authors see the tips they received"],
                  [
                    <b key="w">MCP keys and app tokens</b>,
                    "You create a key or allow an app",
                    "Only their SHA-256 hashes, the app's name and address, and when it was last used. PikaMd can't read your key or tokens back",
                  ],
                  [
                    <b key="w">A coded IP address</b>,
                    "Sign-in, uploads, tip records and app sign-in steps",
                    "Rate limits against abuse. The IP is stored only as a keyed hash (HMAC), never as it is",
                  ],
                ]}
              />
            </Section>

            <Section id="public" title="Public and permanent">
              <p>Some of what you do is recorded outside PikaMd and stays public, on purpose:</p>
              <ul className="docs-list">
                <li>
                  <b>Arc:</b> publishing records your wallet as the author, with the file&apos;s IPFS address and fingerprint. Hiding,
                  moderator locks, tips and moderator approvals are Arc transactions too. Blockchain records can&apos;t be erased by anyone.
                </li>
                <li>
                  <b>IPFS:</b> the file you publish is stored on IPFS through Pinata. PikaMd can stop serving a file, but copies others keep
                  aren&apos;t under its control.
                </li>
              </ul>
              <p>
                That&apos;s why <PageLink href="/new">Publish</PageLink> has a clean-up step that finds personal data and secrets before
                anything goes out.
              </p>
            </Section>

            <Section id="cookies" title="Cookies and browser storage">
              <Table
                head={["Name", "Kind", "Purpose"]}
                rows={[
                  [<code key="n">pikamd_session</code>, "Cookie, 7 days", "Keeps you signed in after the sign-in signature. HttpOnly, SameSite=Strict"],
                  [<code key="n">pikamd:query-cache</code>, "Local storage, 7 days", "Your own recent data (session, collection, likes, profile) so pages open instantly"],
                  [<span key="n">Wallet connection</span>, "Local storage", "Which wallet you connected last, so it reconnects. WalletConnect, if you use it, keeps its own session in your browser"],
                ]}
              />
              <p>Nothing here is used for tracking. Clearing your browser&apos;s site data removes all of it.</p>
            </Section>

            <Section id="agents" title="AI agents">
              <p>
                When you connect an agent such as Claude, it reads the public library and, after you allow it, the list of guidelines in your
                collection. It can&apos;t publish, tip, like, report or change anything. PikaMd doesn&apos;t receive your conversations with
                the agent: it sees only what the agent asks PikaMd for, such as search words and the guideline it wants to read. You can disconnect any app on{" "}
                <PageLink href="/connect">Connect your agent</PageLink>.
              </p>
            </Section>

            <Section id="services" title="Services PikaMd uses">
              <Table
                head={["Service", "For"]}
                rows={[
                  ["Vercel", "Hosting the site and its server. It processes requests, including IP addresses, under its own policy"],
                  ["Supabase", "The database behind likes, collections, the library index and the records above"],
                  ["Pinata (IPFS)", "Storing published files"],
                  ["Arc Network", "Recording authorship, tips and moderation; your browser reads it directly to verify files"],
                  ["WalletConnect (Reown)", "Connecting phone wallets, only if you choose WalletConnect"],
                ]}
              />
            </Section>

            <Section id="keep" title="How long data is kept">
              <ul className="docs-list">
                <li>Coded IP addresses for rate limits: cleared in routine cleanup once their window is more than a day old.</li>
                <li>Used sign-in codes: until they expire, a few minutes. App sign-in requests, codes and expired tokens: cleared in routine cleanup a day after they expire.</li>
                <li>Likes, collections, reports and connected-app records: while PikaMd runs, or until you remove them.</li>
                <li>Published guidelines: permanently on Arc and IPFS, as described above.</li>
              </ul>
            </Section>

            <Section id="choices" title="Your choices">
              <ul className="docs-list">
                <li>Take back a like, or remove a guideline from your collection, at any time.</li>
                <li>Hide a guideline you published: it leaves the site and agents, though the Arc record remains.</li>
                <li>Revoke your MCP key, or disconnect any app, on Connect your agent.</li>
                <li>Disconnect your wallet to end your session.</li>
                <li>
                  To ask about or remove other data, open an issue on <Ext href={ISSUES}>GitHub</Ext>. Don&apos;t post private details there:
                  say what you need and we&apos;ll reply.
                </li>
              </ul>
            </Section>

            <Section id="children" title="Children">
              <p>PikaMd is a tool for developers and isn&apos;t aimed at children.</p>
            </Section>

            <Section id="contact" title="Changes and contact">
              <p>
                When this policy changes, the date at the top changes with it. Questions go to <Ext href={ISSUES}>GitHub Issues</Ext>. The
                code is public, so anyone can check what PikaMd does.
              </p>
            </Section>
          </article>
        </div>
      </main>
    </PageTransition>
  );
}
