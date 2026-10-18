import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AuthorAction from "@/components/AuthorAction";
import CollectButton from "@/components/CollectButton";
import LikeButton from "@/components/LikeButton";
import PageTransition from "@/components/PageTransition";
import ArcVerified from "@/components/guideline/ArcVerified";
import ContentView from "@/components/guideline/ContentView";
import FileActions from "@/components/guideline/FileActions";
import { KIND_LABEL, shortAddress } from "@/components/md-format";
import { CHAIN } from "@/lib/chain";
import { getGuideline } from "@/lib/data/guidelines";
import RawLink from "@/components/guideline/RawLink";
import ReportButton from "@/components/guideline/ReportButton";

// A guideline's own page (ARCHITECTURE §7.2, §11): the file, who wrote it, its record on Arc
// checked in the browser, and how to use it with an agent. The shell is static; the guideline
// streams in (cacheComponents: its slug is only known at request time, and the live site starts
// with none to list at build time).

const explorer = CHAIN.blockExplorers?.default.url;
const LICENSE_NAME = { "CC-BY-4.0": "CC BY 4.0", "CC0-1.0": "CC0 1.0" } as const;

export async function generateMetadata({ params }: PageProps<"/g/[slug]">): Promise<Metadata> {
  const g = await getGuideline((await params).slug);
  if (!g) return { title: "Guideline not found · PikaMd" };
  return { title: `${g.title} · PikaMd`, description: g.description };
}

export default function GuidelinePage({ params }: PageProps<"/g/[slug]">) {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high gl-page-wrap">
          <Suspense fallback={<article className="gl-page pixel-panel" aria-busy="true" />}>
            {params.then(({ slug }) => (
              <GuidelineView slug={slug} />
            ))}
          </Suspense>
        </div>
      </main>
    </PageTransition>
  );
}

async function GuidelineView({ slug }: { slug: string }) {
  const g = await getGuideline(slug);
  if (!g) notFound();
  const authorName = g.author.handle ? `@${g.author.handle}` : shortAddress(g.author.address);

  return (
    <article className="gl-page pixel-panel" aria-labelledby="gl-title">
      <nav className="gl-crumbs" aria-label="Breadcrumb">
        <Link href="/explore">← Explore</Link>
      </nav>

      <header className="gl-head">
        <p className="gl-file">
          <span>{g.slug}.md</span>
          <span className="md-badge">{KIND_LABEL[g.kind]}</span>
          <span className="md-version">v{g.latestVersion}</span>
        </p>
        <h1 id="gl-title" className="gl-title">
          {g.title}
        </h1>
        <p className="gl-desc">{g.description}</p>
        <p className="gl-by">
          by{" "}
          {explorer ? (
            <a href={`${explorer}/address/${g.author.address}`} target="_blank" rel="noopener noreferrer" title={g.author.address}>
              {authorName} ↗
            </a>
          ) : (
            <span title={g.author.address}>{authorName}</span>
          )}
          <span aria-hidden="true"> · </span>
          {LICENSE_NAME[g.license]}
          {g.tags.length > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              {g.tags.map((t) => (
                <Link key={t} href={`/explore?q=${encodeURIComponent(`tag:${t}`)}`} className="gl-tag">
                  #{t}
                </Link>
              ))}
            </>
          )}
        </p>
        <div className="gl-actions md-card-actions">
          <LikeButton slug={g.slug} title={g.title} stars={g.stars} />
          <AuthorAction guideline={g} authorName={authorName} />
          <CollectButton slug={g.slug} title={g.title} long />
        </div>
      </header>

      {g.flagged && (
        <p className="gl-flag" role="note">
          Our automatic checks flagged lines in this file for review. It stays readable here, but agents don&apos;t get it over MCP
          until a moderator looks at it
        </p>
      )}

      <div className="gl-body">
        <div className="gl-main">
          <FileActions slug={g.slug} content={g.content} />
          <ContentView content={g.content} />
        </div>

        <aside className="gl-side" aria-label="About this guideline">
          <section>
            <h2>On Arc</h2>
            {g.record ? (
              <>
                <ArcVerified id={g.id} version={g.latestVersion} content={g.content} />
                <dl className="gl-facts">
                  <div>
                    <dt>Guideline</dt>
                    <dd>#{g.id}</dd>
                  </div>
                  <div>
                    <dt>Recorded in</dt>
                    <dd>
                      {explorer ? (
                        <a href={`${explorer}/tx/${g.record.txHash}`} target="_blank" rel="noopener noreferrer">
                          {g.record.txHash.slice(0, 10)}… ↗
                        </a>
                      ) : (
                        `${g.record.txHash.slice(0, 10)}…`
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>IPFS</dt>
                    <dd>
                      <code title={g.record.cid}>
                        {g.record.cid.slice(0, 10)}…{g.record.cid.slice(-6)}
                      </code>
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="gl-verify is-unavailable">Sample guideline: not recorded on Arc</p>
            )}
          </section>

          <section>
            <h2>Use it with your agent</h2>
            {g.flagged ? (
              <p className="gl-note">Not served to agents while it waits for review</p>
            ) : (
              <>
                <p className="gl-note">
                  Add it to your collection and ask your agent, or point it at the file directly. <Link href="/connect">Connect your agent</Link>
                </p>
                <p className="gl-ask">
                  <span aria-hidden="true">&gt; </span>Use the {g.slug} guideline from PikaMd
                </p>
                <RawLink slug={g.slug} />
              </>
            )}
          </section>

          <ReportButton slug={g.slug} title={g.title} />
        </aside>
      </div>
    </article>
  );
}
