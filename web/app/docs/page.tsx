import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import CopyButton from "@/components/CopyButton";
import PageLink from "@/components/PageLink";
import PageTransition from "@/components/PageTransition";
import DocsToc, { type TocGroup } from "@/components/docs/DocsToc";
import { CHAIN, REGISTRY, REVIEWS, TIPS } from "@/lib/chain";
import { EXAMPLE_ASKS, KEY_PLACEHOLDER, agentSetups, mcpUrl } from "@/lib/mcp/connect";
import { MAX_BYTES, WARN_BYTES } from "@/lib/scan";
import { SUMMARY_MAX, SUMMARY_MIN, TAGS_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/publish/validate";
import { SEARCH_LIMIT_MAX } from "@/lib/search/engine";
import { REPORT_REASONS } from "@/lib/moderation/reasons";
import imgExplore from "@/public/docs/explore.webp";
import imgSearch from "@/public/docs/search.webp";
import imgPreview from "@/public/docs/preview.webp";
import imgConnect from "@/public/docs/connect.webp";
import imgCleanup from "@/public/docs/cleanup.webp";
import imgOnArc from "@/public/docs/on-arc.webp";

export const metadata: Metadata = {
  title: "Docs · PikaMd",
  description:
    "How PikaMd works: find, save and publish AI agent guidelines, connect Claude Code, Cursor, VS Code or Codex over MCP, and what is recorded on Arc.",
};

// The public site; the MCP address and every link in these docs point here. Change it with the domain.
const SITE = "https://pikamd.vercel.app";
const MCP = mcpUrl(SITE);
const EXPLORER = CHAIN.blockExplorers?.default.url ?? "";
const KB = (bytes: number) => `${bytes / 1024} KB`;

const TOC: TocGroup[] = [
  { title: "Getting started", items: [{ id: "overview", label: "Overview" }, { id: "quick-start", label: "Quick start" }, { id: "concepts", label: "Core concepts" }] },
  {
    title: "Using PikaMd",
    items: [
      { id: "find", label: "Find and read" },
      { id: "collections", label: "Collections" },
      { id: "connect", label: "Connect your agent" },
      { id: "publish", label: "Publish a guideline" },
      { id: "likes-tips", label: "Likes, PikaGold and tips" },
    ],
  },
  { title: "Trust", items: [{ id: "safety", label: "Safety and moderation" }, { id: "arc", label: "On Arc" }] },
  { title: "Project", items: [{ id: "principles", label: "Principles and fees" }, { id: "status", label: "Current status" }, { id: "faq", label: "FAQ" }] },
];

// ── Building blocks ───────────────────────────────────────────────────────────────────────
function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="docs-section" aria-labelledby={id}>
      <p className="docs-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="docs-code">
      <div className="docs-code-bar">
        <span>{label ?? ""}</span>
        <CopyButton text={children} />
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Note({ kind = "note", title, children }: { kind?: "note" | "warn"; title: string; children: ReactNode }) {
  return (
    <aside className={`docs-note is-${kind}`}>
      <p className="docs-note-title">{title}</p>
      <div>{children}</div>
    </aside>
  );
}

function Figure({ src, alt, caption }: { src: StaticImageData; alt: string; caption: string }) {
  return (
    <figure className="docs-figure">
      <Image src={src} alt={alt} placeholder="blur" sizes="(max-width: 1023px) 100vw, 820px" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="docs-steps">
      {items.map((s, i) => (
        <li key={s.title}>
          <span className="docs-step-n">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <p className="docs-step-title">{s.title}</p>
            <div className="docs-step-body">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

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

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

const Addr = ({ address }: { address?: string }) =>
  address ? (
    <Ext href={`${EXPLORER}/address/${address}`}>
      <code className="docs-addr">{address}</code>
    </Ext>
  ) : (
    <span>Not deployed on this network</span>
  );

export default function DocsPage() {
  const setups = agentSetups(MCP, KEY_PLACEHOLDER);
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high hero-compact docs-page">
          <h1 className="hero-title">
            PikaMd docs
            <br />
            <span>how it all works</span>
          </h1>
          <p className="hero-sub">
            <span>Find, save and share the guidelines that shape your AI agents</span>{" "}
            <span>Everything about the library, the MCP server and what is recorded on Arc</span>
          </p>

          <div className="docs-layout">
            <DocsToc groups={TOC} />

            <article className="docs-body pixel-panel">
              <Section id="overview" eyebrow="Getting started" title="Overview">
                <p className="docs-lead">
                  PikaMd is a public, community library for the Markdown files that shape how AI agents work: rules files such as
                  CLAUDE.md and AGENTS.md, skills, prompt templates, subagent definitions and guides.
                </p>
                <p>
                  Good guidelines take weeks to refine, and most of them stay in one person&apos;s project folder. PikaMd makes them easy to
                  share, find and reuse. Authors keep the credit, recorded on Arc, and the platform takes no fee.
                </p>
                <div className="docs-cards">
                  <div>
                    <p className="docs-card-title">The library</p>
                    <p>Browse, search and read every published guideline. No account needed.</p>
                  </div>
                  <div>
                    <p className="docs-card-title">Your collection</p>
                    <p>Save the guidelines you trust. Your collection is tied to your wallet.</p>
                  </div>
                  <div>
                    <p className="docs-card-title">The MCP server</p>
                    <p>Connect your agent once and it reads the library and your collection directly.</p>
                  </div>
                </div>
                <p>
                  PikaMd is for developers who work with Claude Code, Cursor, VS Code, Codex or any other MCP client, and for anyone who
                  has written a guideline worth sharing.
                </p>
                <Note title="Live on Arc testnet">
                  PikaMd runs on Arc testnet today. Network fees and tips use testnet USDC, which you can get for free from the{" "}
                  <Ext href="https://faucet.circle.com">Circle faucet</Ext>.
                </Note>
              </Section>

              <Section id="quick-start" eyebrow="Getting started" title="Quick start">
                <p>Five steps from your first visit to an agent that uses the library.</p>
                <Steps
                  items={[
                    {
                      title: "Find a guideline",
                      body: (
                        <>
                          Open <PageLink href="/explore">Explore</PageLink>, search by topic or tag, and press <b>OPEN</b> on a card to read the whole
                          file.
                        </>
                      ),
                    },
                    {
                      title: "Save it",
                      body: (
                        <>
                          Press <b>Connect Wallet</b>, then <b>+ Add</b> on any guideline. The first save asks for one free signature, no fee.
                        </>
                      ),
                    },
                    {
                      title: "Connect your agent",
                      body: (
                        <>
                          On <PageLink href="/connect">Connect your agent</PageLink>, create your key and paste the prompt into your agent. It sets
                          itself up.
                        </>
                      ),
                    },
                    { title: "Ask", body: <>Ask your agent in plain words, for example: &ldquo;{EXAMPLE_ASKS[1]}&rdquo;.</> },
                    {
                      title: "Share your own",
                      body: (
                        <>
                          On <PageLink href="/new">Publish</PageLink>, add your .md file, clean it up, describe it and publish it with your wallet.
                        </>
                      ),
                    },
                  ]}
                />
                <Figure src={imgExplore} alt="The Explore page: a search box above lanes of guideline cards" caption="Explore. Example data shown" />
              </Section>

              <Section id="concepts" eyebrow="Getting started" title="Core concepts">
                <Table
                  head={["Term", "What it means"]}
                  rows={[
                    [<b key="t">Guideline</b>, `One Markdown file that shapes how an agent works, up to ${KB(MAX_BYTES)}. Plain text only: no scripts, folders or binaries.`],
                    [<b key="t">Slug</b>, <>The guideline&apos;s name in addresses, made from its title: <code>secure-solidity</code>, served as <code>secure-solidity.md</code>.</>],
                    [<b key="t">Version</b>, "Every guideline starts at v1. The site and agents read the latest version."],
                    [<b key="t">Collection</b>, "The guidelines you saved, kept with your wallet. Your agent reads it with your key."],
                    [<b key="t">Wallet</b>, "Your identity. Reading needs none; saving, liking and publishing need a connected wallet."],
                    [<b key="t">MCP</b>, "Model Context Protocol, the open standard agents use to call outside tools. PikaMd runs an MCP server."],
                    [<b key="t">Arc record</b>, "What the registry contract stores for each guideline: author, IPFS address, content hash and license."],
                    [<b key="t">IPFS</b>, "Where the file itself is stored, addressed by its content."],
                  ]}
                />
                <h3>Guideline kinds</h3>
                <Table
                  head={["Kind", "Typical file"]}
                  rows={[
                    [<b key="k">Rules</b>, "CLAUDE.md, AGENTS.md, .cursor/rules"],
                    [<b key="k">Skill</b>, "SKILL.md with frontmatter"],
                    [<b key="k">Prompt</b>, "A command or prompt template"],
                    [<b key="k">Agent</b>, "A subagent definition, such as .claude/agents/*.md"],
                    [<b key="k">Guide</b>, "A how-to for people and agents"],
                  ]}
                />
              </Section>

              <Section id="find" eyebrow="Using PikaMd" title="Find and read">
                <p>
                  <PageLink href="/explore">Explore</PageLink> shows every published guideline. Press <kbd>/</kbd> anywhere on the page to jump to
                  the search box. Search looks at titles, summaries, tags, authors and the text inside every file, and shows the matching lines
                  with their line numbers.
                </p>
                <Table
                  head={["Query", "Finds"]}
                  rows={[
                    [<code key="q">react performance</code>, "Guidelines that match every word"],
                    [<code key="q">&quot;exact phrase&quot;</code>, "That phrase, word for word"],
                    [<code key="q">-word</code>, "Leaves out guidelines with that word"],
                    [<code key="q">kind:skill</code>, "One kind: rules, skill, prompt, agent or guide"],
                    [<code key="q">tag:react</code>, "Guidelines with that tag"],
                    [<code key="q">author:0x3C44</code>, "Guidelines by an author, by the start of their address"],
                  ]}
                />
                <p>Longer words forgive a small typo; results found that way are marked as a close spelling and listed after exact matches.</p>
                <Figure src={imgSearch} alt="Search results with the matching lines highlighted" caption="Search shows the lines that matched. Example data shown" />
                <h3>Reading a guideline</h3>
                <p>
                  <b>OPEN</b> shows the full file in place. Each guideline also has its own page with the file rendered or as raw Markdown,
                  buttons to copy or download it, and its Arc record.
                </p>
                <ul className="docs-list">
                  <li>
                    The raw file is at <code>{SITE}/raw/&lt;slug&gt;.md</code>, as plain text, so you can hand the address to any tool.
                  </li>
                  <li>The page checks in your browser that the text matches the hash recorded on Arc, and says so.</li>
                </ul>
                <Figure src={imgPreview} alt="A guideline opened in the preview, with like, tip and add to collection buttons" caption="The full file, one press away. Example data shown" />
              </Section>

              <Section id="collections" eyebrow="Using PikaMd" title="Collections">
                <p>
                  Press <b>+ Add</b> on a card, or <b>+ Add to collection</b> on a guideline, to save it. Press it again to remove it. Your
                  collection lives with your wallet, so it follows you to any browser, and your agent reads the same list.
                </p>
                <ul className="docs-list">
                  <li>
                    <PageLink href="/collection">My Collection</PageLink> has two tabs: <b>Saved</b> and <b>Shared by me</b>, the guidelines you
                    published.
                  </li>
                  <li>A collection holds up to 500 guidelines.</li>
                  <li>If an author hides a guideline, it leaves your collection while hidden and comes back if it is shown again.</li>
                </ul>
                <h3>Hiding your own guideline</h3>
                <p>
                  Under <b>Shared by me</b>, or on your own cards, <b>Hide</b> takes a guideline off the site and away from agents. <b>Show</b>{" "}
                  brings it back. Each is a small transaction on Arc. The Arc record and the IPFS file remain: hiding is not deleting.
                </p>
              </Section>

              <Section id="connect" eyebrow="Using PikaMd" title="Connect your agent">
                <p>
                  PikaMd runs an MCP server over Streamable HTTP. Searching and reading work without a key. Your key adds{" "}
                  <code>my_collection</code>, the guidelines you saved with your wallet.
                </p>
                <Table head={["Setting", "Value"]} rows={[["Server address", <code key="v">{MCP}</code>], ["Server name", <code key="v">pikamd</code>], ["Authentication", <><code>Authorization: Bearer pmd_…</code> header</>]]} />
                <h3>1. Create your key</h3>
                <p>
                  On <PageLink href="/connect">Connect your agent</PageLink>, connect your wallet and press <b>Create key</b>. The key is made in
                  your browser and shown once; PikaMd stores only its SHA-256 hash, so it can&apos;t show it again or leak it. Creating a new key
                  replaces the old one, and <b>Revoke</b> turns it off.
                </p>
                <Figure src={imgConnect} alt="The Connect your agent page: create a key, then paste one prompt into your agent" caption="Connect your agent" />
                <h3>2. Add PikaMd to your agent</h3>
                <p>
                  The quickest way is the ready-made prompt on the Connect page: paste it into your agent and it adds PikaMd to its own settings.
                  To set it up yourself, use the snippet for your tool and replace <code>{KEY_PLACEHOLDER}</code> with your key.
                </p>
                {setups.map((s) => (
                  <div key={s.id} className="docs-setup">
                    <p className="docs-setup-title">
                      {s.label} <span>{s.where}</span>
                    </p>
                    <Code label={s.language}>{s.snippet}</Code>
                    <ul className="docs-list is-small">
                      {s.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Note kind="warn" title="Keep the key private">
                  Put it in your user-level settings only, never in a project file or a git repository. If it leaks, create a new one.
                </Note>
                <h3>3. Ask</h3>
                <ul className="docs-list">
                  {EXAMPLE_ASKS.map((a) => (
                    <li key={a}>&ldquo;{a}&rdquo;</li>
                  ))}
                </ul>
                <h3>Tools</h3>
                <Table
                  head={["Tool", "Key", "What it does"]}
                  rows={[
                    [<code key="t">search_guidelines</code>, "No", `Searches the library with the same engine and query syntax as the site; up to ${SEARCH_LIMIT_MAX} results with the matching lines`],
                    [<code key="t">get_guideline</code>, "No", "Returns one guideline's full Markdown with its author, version, license and Arc record"],
                    [<code key="t">my_collection</code>, "Yes", "Lists the guidelines in your collection, newest first"],
                  ]}
                />
                <p>
                  Every guideline reaches your agent labeled as community reference data, not instructions, and only after its text has been
                  checked against the hash on Arc. Guidelines the scan flagged are not served to agents.
                </p>
                <Note title="Not yet supported">
                  claude.ai, Claude Desktop and the mobile apps connect only through OAuth, which PikaMd doesn&apos;t offer yet. Use a tool that
                  accepts a custom header, such as the four above.
                </Note>
              </Section>

              <Section id="publish" eyebrow="Using PikaMd" title="Publish a guideline">
                <p>Publishing takes four short steps on the <PageLink href="/new">Publish</PageLink> page. Your draft is kept in your browser until you finish.</p>
                <Note title="Before you start">
                  You need a wallet with a little testnet USDC for the network fee, usually less than a cent. Ask your own agent for a clean copy
                  of your file first: the Publish page gives you a ready prompt that swaps names, paths and keys for placeholders.
                </Note>
                <Steps
                  items={[
                    {
                      title: "File",
                      body: `Drop in a .md file or write one. The limit is ${KB(MAX_BYTES)}; above ${KB(WARN_BYTES)} you get a warning, since long files cost your agent context. Invisible characters are removed and the kind is guessed from the file name.`,
                    },
                    { title: "Clean up", body: "PikaMd marks anything that looks private or risky, and suggests a placeholder for each. You decide what stays. This step can't be skipped." },
                    {
                      title: "Details",
                      body: `A title (${TITLE_MIN}–${TITLE_MAX} characters), a summary (${SUMMARY_MIN}–${SUMMARY_MAX}), the kind and up to ${TAGS_MAX} tags. Every guideline is shared under CC BY 4.0.`,
                    },
                    { title: "Publish", body: "PikaMd checks the file again on the server and stores it on IPFS, then your wallet records it on Arc. Your wallet is the author." },
                  ]}
                />
                <Figure src={imgCleanup} alt="The Clean up step: findings on the left, the file with highlights on the right" caption="Clean up: each finding comes with a placeholder" />
                <h3>What the clean-up step looks for</h3>
                <Table
                  head={["Finding", "Examples", "What happens"]}
                  rows={[
                    [<b key="f">Secrets</b>, "API keys, private keys, seed phrases, tokens", "Must be removed; publishing stays locked until they are gone"],
                    [<b key="f">Personal data</b>, "Emails, phone numbers, local paths, wallet addresses, private network addresses, words you mark as private", "Replace with a placeholder or keep it if it is meant to be public"],
                    [<b key="f">To review</b>, "Content the site doesn't show but agents read (HTML comments, hidden HTML, link titles), and instructions that try to override an agent or run unknown code", "Remove it, or keep it: the guideline is then not served to agents until a moderator reads it"],
                  ]}
                />
                <p>The same checks run again on the server, so a modified browser can&apos;t skip them. Automatic checks catch common patterns, not everything: read your file once more before you publish.</p>
                <Note kind="warn" title="Treat published guidelines as permanent">
                  The file is stored on IPFS and its record on Arc can&apos;t be erased. You can hide a guideline at any time, but copies may
                  remain.
                </Note>
              </Section>

              <Section id="likes-tips" eyebrow="Using PikaMd" title="Likes, PikaGold and tips">
                <h3>Likes and PikaGold</h3>
                <p>
                  Each wallet can like a guideline once, and take the like back. The first like from a wallet gives the author 1 PikaGold.
                  PikaGold is a reputation score: it is not a token, can&apos;t be transferred and has no money value. Authors keep it if a like is
                  taken back or they hide the guideline; a moderator lock removes it.
                </p>
                <h3>Tips</h3>
                <p>
                  Press <b>★ Tip</b> to send USDC to the author. The tip goes from your wallet straight to theirs in the same transaction:
                  PikaMd never holds it and takes no cut. The recipient is read from the guideline&apos;s Arc record, so no one can redirect it.
                </p>
                <ul className="docs-list">
                  <li>From 0.01 to 1,000 USDC per tip.</li>
                  <li>Your wallet asks twice: once to allow that exact amount, once to send it. If the allowance is already there, once.</li>
                  <li>You can&apos;t tip your own guideline, or one that is hidden or locked.</li>
                  <li>Authors see the tips they received in their wallet menu.</li>
                </ul>
              </Section>

              <Section id="safety" eyebrow="Trust" title="Safety and moderation">
                <p>Guidelines are instructions for AI agents, so PikaMd checks them at every step.</p>
                <Table
                  head={["Layer", "What it does"]}
                  rows={[
                    [<b key="l">Scan</b>, "Every file is scanned in the browser and again on the server before it goes public."],
                    [<b key="l">Flagged files</b>, "Files with content to review stay visible on the site, marked, but are not served to agents or as raw files until a moderator approves them."],
                    [<b key="l">Integrity check</b>, "Each time an agent or the raw address reads a guideline, its SHA-256 is compared with the hash on Arc. If they differ, it isn't served."],
                    [<b key="l">Safe display</b>, "The site renders Markdown without raw HTML or scripts."],
                    [<b key="l">Verified badge</b>, "A PikaMd moderator read this exact version and approved it on Arc. It lapses if the author publishes a new version or the guideline is locked."],
                    [<b key="l">Reports</b>, "Anyone with a wallet can report a guideline from its page, once per guideline."],
                    [<b key="l">Moderator lock</b>, "Removes a guideline from Explore, search, its page, the raw address and agents, recorded on Arc."],
                  ]}
                />
                <Note kind="warn" title="What Verified means">
                  A review lowers the risk; it isn&apos;t a guarantee. Read a guideline before your agent applies it to your work.
                </Note>
                <Figure src={imgOnArc} alt="The On Arc panel: verified against Arc and reviewed by a PikaMd moderator" caption="Each guideline page checks its Arc record in your browser" />
                <h3>Report reasons</h3>
                <ul className="docs-list">
                  {REPORT_REASONS.map((r) => (
                    <li key={r.code}>
                      <b>{r.label}</b>: {r.hint}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section id="arc" eyebrow="Trust" title="On Arc">
                <p>
                  PikaMd is built on <Ext href="https://docs.arc.io">Arc Network</Ext>, an EVM blockchain where network fees are paid in USDC.
                  Arc records who wrote each guideline and fingerprints its text, so authorship and integrity don&apos;t depend on PikaMd&apos;s servers.
                </p>
                <Table
                  head={["Network", ""]}
                  rows={[
                    ["Name", CHAIN.name],
                    ["Chain ID", String(CHAIN.id)],
                    ["Gas token", "USDC"],
                    ["Explorer", <Ext key="e" href={EXPLORER}>{EXPLORER.replace("https://", "")}</Ext>],
                  ]}
                />
                <h3>Contracts</h3>
                <Table
                  head={["Contract", "Role", "Address"]}
                  rows={[
                    ["GuidelineRegistry", "Authors, IPFS addresses, content hashes, versions, hiding and moderator locks", <Addr key="a" address={REGISTRY?.address} />],
                    ["GuidelineTips", "Sends tips from the tipper straight to the author; holds no funds, has no owner", <Addr key="a" address={TIPS?.address} />],
                    ["GuidelineReviews", "Moderator approvals behind the Verified badge; has no owner", <Addr key="a" address={REVIEWS?.address} />],
                  ]}
                />
                <p>All three contracts are verified on Sourcify and the Arc explorer, so their source can be read.</p>
                <h3>On chain and off chain</h3>
                <Table
                  head={["On Arc", "Elsewhere"]}
                  rows={[
                    ["Author wallet, IPFS address (CID), SHA-256 of the text, license, versions", "The file itself, on IPFS"],
                    ["Hiding and moderator locks", "Title, summary and tags, in PikaMd's index"],
                    ["Tips and moderator approvals", "Likes, PikaGold, collections and keys, in PikaMd's database"],
                  ]}
                />
              </Section>

              <Section id="principles" eyebrow="Project" title="Principles and fees">
                <ul className="docs-list">
                  <li>
                    <b>Free to read.</b> No account, no paywall. Saving and connecting your agent are free too.
                  </li>
                  <li>
                    <b>0% platform fee.</b> Publishing costs only Arc&apos;s network fee, and tips go to authors in full. None of it goes to PikaMd.
                  </li>
                  <li>
                    <b>Your wallet, your work.</b> You publish from your own wallet, so the authorship is yours on Arc.
                  </li>
                  <li>
                    <b>Open.</b> Guidelines are shared under CC BY 4.0, and the code is public on{" "}
                    <Ext href="https://github.com/nftpoetrist/pikamd">GitHub</Ext>.
                  </li>
                  <li>
                    <b>Built by the community, for the community.</b> PikaMd is a non-profit project.
                  </li>
                </ul>
              </Section>

              <Section id="status" eyebrow="Project" title="Current status">
                <p>PikaMd is early. This is where it stands today.</p>
                <Table
                  head={["Available now", "Not yet"]}
                  rows={[
                    ["Explore, search, reading and raw files", "Older versions and pinning a version, such as slug@v3"],
                    ["Collections, likes, PikaGold and tips", "Forks of a guideline"],
                    ["Publishing with clean-up and an Arc record", "claude.ai, Claude Desktop and mobile (need OAuth)"],
                    ["MCP for Claude Code, Cursor, VS Code, Codex", "Arc mainnet"],
                    ["Reports, moderation and the Verified badge", "A domain of its own"],
                  ]}
                />
              </Section>

              <Section id="faq" eyebrow="Project" title="FAQ">
                <dl className="docs-faq">
                  <dt>Do I need a wallet to read guidelines?</dt>
                  <dd>No. Reading, searching, copying and downloading need no account. A wallet is needed to save, like, tip and publish.</dd>
                  <dt>What does it cost?</dt>
                  <dd>Reading, saving and connecting your agent are free. Publishing and hiding cost a small Arc network fee, usually less than a cent. Tips are optional.</dd>
                  <dt>Can I delete a guideline?</dt>
                  <dd>You can hide it, which takes it off the site and away from agents. The Arc record and the IPFS file remain.</dd>
                  <dt>Which agents work with PikaMd?</dt>
                  <dd>Any MCP client that connects over HTTP with a custom header: Claude Code, Cursor, VS Code, Codex and others.</dd>
                  <dt>Is a Verified guideline safe?</dt>
                  <dd>It means a moderator read that exact version and approved it. That lowers the risk but isn&apos;t a guarantee.</dd>
                  <dt>Can PikaMd see my key?</dt>
                  <dd>No. The key is created in your browser; PikaMd stores only its hash and a masked form such as pmd_3f9a…c21e.</dd>
                  <dt>Why does my wallet show a warning?</dt>
                  <dd>Some wallet scanners flag new *.vercel.app addresses by default. PikaMd asks your wallet only for a free sign-in signature and for the transactions you start yourself: publishing, hiding and tips. Check each request in your wallet before you approve it.</dd>
                </dl>
                <p className="docs-links">
                  More: <Ext href="https://github.com/nftpoetrist/pikamd">GitHub</Ext> · <Ext href="https://x.com/PikaStake">PikaMd on X</Ext> ·{" "}
                  <Ext href="https://docs.arc.io">Arc docs</Ext>
                </p>
              </Section>
            </article>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
