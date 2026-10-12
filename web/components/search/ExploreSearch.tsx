"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import MdPreview from "@/components/MdPreview";
import { KIND_LABEL, PixelHeart, shortAddress } from "@/components/md-format";
import Marked from "@/components/search/Marked";
import { useLikeSummary } from "@/lib/likes/client";
import { KINDS, QUERY_MAX_LENGTH, hasFilter, toggleFilter } from "@/lib/search/query";
import type { SearchResponse, SearchResultItem } from "@/lib/search/response";
import type { Guideline } from "@/lib/types";
import { api } from "@/lib/wallet/api";

const DEBOUNCE_MS = 200;
const RESULT_LIMIT = 8;
const SYNTAX_HINT = '"exact phrase" · -leave_out · kind:skill · tag:react · author:@name';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

async function fetchSearch(q: string, signal: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${RESULT_LIMIT}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("search failed");
  return res.json();
}

const authorName = (hit: SearchResultItem) => (hit.author.handle ? `@${hit.author.handle}` : shortAddress(hit.author.address));

type Preview = { guideline: Guideline; line?: number; origin: RefObject<HTMLElement | null>; closing: boolean };

/** Static stand-in while the URL is read on the client (Suspense fallback): same size, no layout shift. */
export function SearchBoxShell() {
  return (
    <div className="srch">
      <div className="srch-box">
        <SearchIcon />
        <input className="srch-input" placeholder="Search guidelines, tags, authors or text inside files" aria-label="Search guidelines" disabled />
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="srch-icon" width="18" height="18" viewBox="0 0 9 9" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 0h3v1H2zM1 1h1v1H1zM5 1h1v1H5zM0 2h1v3H0zM6 2h1v3H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v1H2zM6 6h1v1H6zM7 7h1v1H7zM8 8h1v1H8z" />
    </svg>
  );
}

// Explore search (ARCHITECTURE §11): a dropdown above the lanes. Searches titles, tags, types,
// authors and the text inside every file with the same engine as the MCP tool (lib/search).
// The query text is the single source of truth: the filter buttons edit it, and it lives in ?q=.
export default function ExploreSearch({ topTags }: { topTags: string[] }) {
  const pathname = usePathname();
  const initial = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initial.slice(0, QUERY_MAX_LENGTH));
  const [open, setOpen] = useState(initial.length > 0);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const listId = useId();
  const client = useQueryClient();
  const likes = useLikeSummary();

  const q = useDebounced(query.trim(), DEBOUNCE_MS);
  const search = useQuery({
    queryKey: ["search", q],
    queryFn: ({ signal }) => fetchSearch(q, signal),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });
  const data = q.length > 0 ? search.data : undefined;
  const hits = data?.hits ?? [];
  const active = hits.find((h) => h.slug === activeSlug) ?? null;

  // Keep ?q= in step with the search (shareable link); replaceState doesn't add history entries
  useEffect(() => {
    const next = q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next);
  }, [q, pathname]);

  // "/" anywhere on the page jumps to the search box (unless typing somewhere else)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open], .mdp-panel")) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes the dropdown (not while a preview is up: it sits above everything)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (preview || wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, preview]);

  const edit = (value: string) => {
    setQuery(value.slice(0, QUERY_MAX_LENGTH));
    setActiveSlug(null);
    setOpenError(null);
    setOpen(true);
  };

  const openHit = async (hit: SearchResultItem) => {
    setOpenError(null);
    setOpening(hit.slug);
    try {
      const guideline = await client.fetchQuery({
        queryKey: ["guideline", hit.slug],
        queryFn: () => api<Guideline>(`/api/guidelines/${encodeURIComponent(hit.slug)}`),
        staleTime: 60_000,
      });
      setPreview({ guideline, line: hit.lines[0]?.line, origin: { current: rows.current.get(hit.slug) ?? null }, closing: false });
    } catch {
      setOpenError("Couldn't open this guideline, try again");
    } finally {
      setOpening(null);
    }
  };

  const move = (step: number) => {
    if (hits.length === 0) return;
    const i = active ? hits.indexOf(active) : -1;
    const next = hits[(i + step + hits.length) % hits.length];
    setActiveSlug(next.slug);
    rows.current.get(next.slug)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      const target = active ?? hits[0];
      if (open && target) {
        e.preventDefault();
        void openHit(target);
      }
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else if (query) edit("");
    }
  };

  // Stable callbacks: the preview's close animation effect depends on them
  const closePreview = useCallback(() => setPreview((p) => (p ? { ...p, closing: true } : p)), []);
  const previewClosed = useCallback(() => {
    setPreview(null);
    inputRef.current?.focus();
  }, []);

  const count = (slug: string, fallback: number) => likes.data?.counts[slug] ?? fallback;
  const showResults = open && q.length > 0;
  const status = !q
    ? ""
    : search.isError
      ? "Search isn't available right now"
      : data
        ? data.total === 0
          ? "No guidelines match"
          : `${data.total} guideline${data.total === 1 ? "" : "s"} found`
        : "Searching";

  return (
    <div ref={wrapRef} className="srch">
      <div className={open ? "srch-box is-open" : "srch-box"}>
        <SearchIcon />
        <input
          ref={inputRef}
          className="srch-input"
          type="search"
          role="combobox"
          aria-label="Search guidelines"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? `${listId}-${active.slug}` : undefined}
          placeholder="Search guidelines, tags, authors or text inside files"
          autoComplete="off"
          spellCheck={false}
          maxLength={QUERY_MAX_LENGTH}
          value={query}
          onChange={(e) => edit(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="srch-clear"
            aria-label="Clear search"
            onClick={() => {
              edit("");
              inputRef.current?.focus();
            }}
          >
            <svg width="10" height="10" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h3v3H2zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z" />
            </svg>
          </button>
        ) : (
          <kbd className="srch-key" aria-hidden="true">
            /
          </kbd>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {open && (
        <div className="srch-panel pixel-panel">
          <div className="srch-filters" role="group" aria-label="Filters">
            <span className="srch-filters-label">Type</span>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className="srch-chip"
                aria-pressed={hasFilter(query, "kind", k)}
                onClick={() => edit(toggleFilter(query, "kind", k))}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {topTags.length > 0 && (
            <div className="srch-filters" role="group" aria-label="Popular tags">
              <span className="srch-filters-label">Tags</span>
              {topTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="srch-chip srch-chip-tag"
                  aria-pressed={hasFilter(query, "tag", t)}
                  onClick={() => edit(toggleFilter(query, "tag", t))}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {data?.warnings.map((w) => (
            <p key={w} className="srch-warning" role="alert">
              {w}
            </p>
          ))}

          <ul id={listId} role="listbox" aria-label="Search results" className="srch-results">
            {showResults &&
              hits.map((hit) => (
                <li
                  key={hit.slug}
                  id={`${listId}-${hit.slug}`}
                  ref={(el) => {
                    if (el) rows.current.set(hit.slug, el);
                    else rows.current.delete(hit.slug);
                  }}
                  role="option"
                  aria-selected={active?.slug === hit.slug}
                  aria-busy={opening === hit.slug || undefined}
                  className="srch-hit"
                  onMouseEnter={() => setActiveSlug(hit.slug)}
                  onClick={() => void openHit(hit)}
                >
                  <div className="srch-hit-head">
                    <span className="srch-hit-title">
                      <Marked text={hit.title} ranges={hit.titleRanges} />
                    </span>
                    <span className="md-badge">{KIND_LABEL[hit.kind]}</span>
                    <span className="srch-hit-likes">
                      <PixelHeart size={11} />
                      {count(hit.slug, hit.stars).toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="srch-hit-meta">
                    <span className="srch-file">{hit.slug}.md</span>
                    <span>v{hit.latestVersion}</span>
                    <span>{authorName(hit)}</span>
                    {!hit.exact && <span className="srch-fuzzy">close spelling</span>}
                  </div>
                  <p className="srch-hit-desc">
                    <Marked text={hit.description} ranges={hit.descriptionRanges} />
                  </p>
                  {hit.lines.map((l) => (
                    <div key={l.line} className="srch-hit-line">
                      <span className="srch-ln" aria-label={`line ${l.line}`}>
                        {l.line}
                      </span>
                      <code>
                        <Marked text={l.text} ranges={l.ranges} />
                      </code>
                    </div>
                  ))}
                </li>
              ))}
          </ul>

          {showResults && data && data.total === 0 && (
            <p className="srch-empty">No guidelines match. Try fewer words, check the spelling or remove a filter</p>
          )}
          {showResults && search.isError && <p className="srch-empty">Search isn&apos;t available right now, try again</p>}
          {showResults && !data && !search.isError && <p className="srch-empty">Searching…</p>}
          {openError && (
            <p className="srch-warning" role="alert">
              {openError}
            </p>
          )}

          <div className="srch-foot">
            {showResults && data && data.total > 0 ? (
              <span>
                {data.total > hits.length ? `Top ${hits.length} of ${data.total}. Add words or filters to narrow it` : `${data.total} guideline${data.total === 1 ? "" : "s"}`}
                <span className="srch-keys-hint"> · ↑↓ to move, Enter to open</span>
              </span>
            ) : (
              <span>Search titles, tags, authors and the text inside every file</span>
            )}
            <code className="srch-syntax">{SYNTAX_HINT}</code>
          </div>
        </div>
      )}

      {preview && (
        <MdPreview
          guideline={preview.guideline}
          card={preview.origin}
          focusLine={preview.line}
          closing={preview.closing}
          onClose={closePreview}
          onClosed={previewClosed}
        />
      )}
    </div>
  );
}
