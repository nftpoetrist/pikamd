// Guideline scanner (ARCHITECTURE §9.1, §9.1.1). Rule-based on purpose: the same
// pure function runs in the browser now (Clean up step) and on the server later
// (the prepare step), because client-side checks can be bypassed.
//
// No imports: this file also runs directly under `node --test`.

export type Severity =
  | "block" // secrets: publishing is impossible until removed
  | "personal" // personal / project data: replace with a placeholder or keep on purpose
  | "review" // possible harmful instruction: flagged for moderation, not served over MCP
  | "info"; // shown for transparency (external links, HTML that is stripped on display)

export interface Finding {
  /** Stable while the text doesn't change: rule + offset. */
  id: string;
  rule: string;
  severity: Severity;
  /** Offsets into the scanned text. */
  start: number;
  end: number;
  line: number; // 1-based
  match: string;
  message: string;
  /** Suggested replacement for block / personal findings. */
  placeholder?: string;
}

export interface ScanResult {
  findings: Finding[];
  counts: Record<Severity, number>;
}

export const MAX_BYTES = 512 * 1024; // hard limit: rejected above this
export const WARN_BYTES = 100 * 1024; // soft limit: long-context warning

type Rule = {
  rule: string;
  severity: Severity;
  pattern: RegExp; // must be global
  message: string;
  placeholder?: string;
  /** Which capture group is the sensitive part (default: whole match). */
  group?: number;
  /** Return false to skip an obvious false positive. */
  accept?: (match: string) => boolean;
  /** Skip matches inside code blocks and code spans: the site shows code as it is. */
  outsideCode?: boolean;
};

// Every pattern must run in linear time on a 512 KB file: the server scans whatever a signed-in
// wallet sends (/api/guidelines/prepare). So no unbounded run that can restart inside itself:
// a lookbehind pins where a token may start, repetitions are capped, and "A and B on one line"
// checks the line once instead of backtracking (scan.test.mjs times adversarial inputs).

// Values that are clearly examples, not real data.
const PLACEHOLDER_HINT = /^[<{[]|your|example|sample|dummy|placeholder|changeme|x{4,}|\*{4,}|\.{3}|…/i;
const isRealValue = (v: string) => !PLACEHOLDER_HINT.test(v);

const SENDS = /\b(?:curl|wget|fetch|POST|upload|send|webhook)\b/i;

const EXAMPLE_EMAIL = /@(example\.(com|org|net)|test\.com|localhost)$|^(no-?reply|noreply\+?[\w.-]*)@/i;

const RULES: Rule[] = [
  // ── Secrets (block) ──────────────────────────────────────────
  { rule: "private-key-block", severity: "block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, message: "Private key block", placeholder: "{{PRIVATE_KEY}}" },
  { rule: "anthropic-openai-key", severity: "block", pattern: /(?<![A-Za-z0-9_-])sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, message: "API key (Anthropic / OpenAI style)", placeholder: "{{API_KEY}}" },
  { rule: "github-token", severity: "block", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,})/g, message: "GitHub token", placeholder: "{{GITHUB_TOKEN}}" },
  { rule: "aws-key", severity: "block", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, message: "AWS access key", placeholder: "{{AWS_ACCESS_KEY}}" },
  { rule: "slack-token", severity: "block", pattern: /(?<![A-Za-z0-9-])xox[abprs]-[A-Za-z0-9-]{10,}/g, message: "Slack token", placeholder: "{{SLACK_TOKEN}}" },
  { rule: "google-key", severity: "block", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, message: "Google API key", placeholder: "{{GOOGLE_API_KEY}}" },
  { rule: "stripe-key", severity: "block", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g, message: "Stripe secret key", placeholder: "{{STRIPE_KEY}}" },
  { rule: "pikamd-key", severity: "block", pattern: /\bpmd_[a-f0-9]{40}\b/g, message: "PikaMd MCP key", placeholder: "{{PIKAMD_KEY}}" },
  { rule: "hex-private-key", severity: "block", pattern: /\b0x[a-fA-F0-9]{64}\b/g, message: "Looks like a wallet private key (or a transaction hash)", placeholder: "{{PRIVATE_KEY}}" },
  { rule: "jwt", severity: "block", pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, message: "JWT / session token", placeholder: "{{TOKEN}}" },
  { rule: "bearer-token", severity: "block", pattern: /\bBearer\s+([A-Za-z0-9._~+/-]{20,}=*)/g, group: 1, message: "Bearer token", placeholder: "{{TOKEN}}", accept: isRealValue },
  {
    rule: "secret-assignment",
    severity: "block",
    pattern: /\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["']?([^\s"'`,;]{8,})/gi,
    group: 1,
    message: "Secret value",
    placeholder: "{{SECRET}}",
    accept: (v) => isRealValue(v) && !/^\$|^process\.env|^env\.|^os\.environ/.test(v),
  },
  {
    // 12–24 bare lowercase words on a line of their own: the shape of a recovery phrase.
    rule: "seed-phrase",
    severity: "block",
    pattern: /^[ \t]*((?:[a-z]{3,8} ){11}(?:[a-z]{3,8} ){0,12}[a-z]{3,8})[ \t]*$/gm,
    group: 1,
    message: "Looks like a wallet recovery phrase",
    placeholder: "{{SEED_PHRASE}}",
    accept: (v) => [12, 15, 18, 21, 24].includes(v.split(" ").length),
  },

  // ── Personal / project data (replace or keep) ────────────────
  { rule: "email", severity: "personal", pattern: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,16}\.[A-Za-z]{2,24}\b/g, message: "Email address", placeholder: "{{EMAIL}}", accept: (v) => !EXAMPLE_EMAIL.test(v) },
  { rule: "phone", severity: "personal", pattern: /(?<![\w.+])(?:\+\d{1,3}[ -]?\(?\d{2,4}\)?(?:[ -]?\d{2,4}){2,4}|\b0 ?5\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2})(?!\w|\.\d)/g, message: "Phone number", placeholder: "{{PHONE}}" },
  { rule: "local-path", severity: "personal", pattern: /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)([^\s/\\`'"<>)\]]+)[^\s`'"<>)\]]*/g, message: "Local file path (shows your user name)", placeholder: "{{PROJECT_PATH}}", accept: (v) => !/^(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)(?:<|\{|…|\.\.\.|\*|(?:you|your|username|user|me|name)\b)/i.test(v) },
  { rule: "wallet-address", severity: "personal", pattern: /\b0x[a-fA-F0-9]{40}\b/g, message: "Wallet or contract address (public contract addresses are fine to keep)", placeholder: "{{WALLET_ADDRESS}}" },
  { rule: "private-ip", severity: "personal", pattern: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, message: "Private network address", placeholder: "{{INTERNAL_URL}}" },
  { rule: "internal-host", severity: "personal", pattern: /(?<![A-Za-z0-9.-])(?:https?:\/\/)?[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,16}\.(?:internal|corp|lan|intranet)\b(?::\d+)?(?:\/[^\s)\]`'"]*)?|(?<![A-Za-z0-9.-])(?:https?:\/\/)?[A-Za-z0-9-]{1,63}-internal(?:\.[A-Za-z0-9-]{1,63}){1,16}\b(?:\/[^\s)\]`'"]*)?/gi, message: "Internal host name", placeholder: "{{INTERNAL_URL}}" },

  // ── Possible harmful instructions (review) ───────────────────
  { rule: "override-instructions", severity: "review", pattern: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+|your\s+)*(?:previous|prior|above|earlier|system|other)\s+(?:instructions|rules|prompts?|messages|guidelines)\b/gi, message: "Tries to override the agent's other instructions" },
  { rule: "override-instructions-tr", severity: "review", pattern: /önceki\s+(?:tüm\s+)?(?:talimatları|kuralları|yönergeleri)\s+(?:unut|yok\s+say|görmezden\s+gel)/gi, message: "Tries to override the agent's other instructions" },
  { rule: "system-prompt", severity: "review", pattern: /\b(?:new|override|replace|reveal|print)\s+(?:the\s+|your\s+)?system\s+prompt\b/gi, message: "Tries to change or reveal the system prompt" },
  { rule: "hide-from-user", severity: "review", pattern: /\b(?:without\s+(?:telling|asking|informing|notifying)\s+the\s+user|(?:don't|do\s+not|never)\s+(?:tell|inform|show|mention\s+(?:this\s+)?to)\s+the\s+user)\b/gi, message: "Asks the agent to hide something from the user" },
  { rule: "pipe-to-shell", severity: "review", pattern: /\b(?:curl|wget)\b(?:(?!\b(?:curl|wget)\b)[^\n|])*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/g, message: "Downloads and runs a script in one step" },
  { rule: "destructive-command", severity: "review", pattern: /\brm\s+-[a-z]*\s+(?:\/|~|\$HOME)(?=\s|$|\/\*)/g, message: "Deletes the home or root folder", accept: (v) => /^rm\s+-[a-z]*r/.test(v) },
  {
    // A line that names a secret file and a way to send it, in either order
    rule: "exfiltration",
    severity: "review",
    pattern: /^.*(?:\.env\b|id_rsa|id_ed25519|\.ssh\/|\.aws\/credentials|keychain|wallet\.dat).*$/gim,
    message: "Reads secrets and sends them somewhere",
    accept: (line) => SENDS.test(line),
  },
  { rule: "encoded-blob", severity: "review", pattern: /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{200,}={0,2}/g, message: "Long encoded block: hidden instructions can live here" },

  // ── Hidden from readers, read by agents (review) ─────────────
  // The site renders Markdown without raw HTML (react-markdown + rehype-sanitize), while agents
  // get the file as it is: whatever the page drops is a channel only agents see. Measured with the
  // site's renderer (2026-10-23): comments, HTML blocks and tag attributes vanish, link titles
  // show only on hover. Code blocks and code spans are shown as they are, so they're skipped.
  { rule: "hidden-comment", severity: "review", outsideCode: true, pattern: /<!--(?:[^-]|-(?!->)){0,4000}(?:-->)?/g, message: "HTML comment: the site doesn't show it, but agents read it" },
  {
    rule: "hidden-html",
    severity: "review",
    outsideCode: true,
    // Any tag but a few plain inline ones without attributes, whose text the page still shows
    pattern: /<(?!(?:br|b|i|em|strong|u|s|sub|sup|kbd|mark|del|ins|small)\s*\/?>)[A-Za-z][A-Za-z0-9-]{0,40}(?:[ \t][^<>\n]{0,500})?\/?>/g,
    message: "HTML: the site doesn't show it or its attributes, but agents read it",
  },
  { rule: "hidden-title", severity: "review", outsideCode: true, pattern: /\]\([^\s()]{1,2000}([ \t]+(?:"[^"\n]{1,500}"|'[^'\n]{1,500}'))\)/g, group: 1, message: "Link title: shown only on hover, but agents read it" },

  // ── Transparency (info) ──────────────────────────────────────
  { rule: "html-script", severity: "info", pattern: /<script\b[^>\n]{0,500}>|\bjavascript:/gi, message: "Script or javascript: link (removed when displayed)" },
];

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()\]`'"]+/g;

function lineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineOf(starts: number[], offset: number) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * 1 for every character inside a fenced code block or a code span: shown as written on the
 * site. Linear: fences line by line; within a line, each backtick run closes at the next run of
 * the same length (found right to left once), and anything between is code.
 */
export function codeMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  let fence: { char: string; len: number } | null = null;
  let fenceStart = 0;
  let pos = 0;
  while (pos <= text.length) {
    let end = text.indexOf("\n", pos);
    if (end === -1) end = text.length;
    const line = text.slice(pos, end);
    const open = FENCE.exec(line);
    if (fence) {
      if (open && open[1][0] === fence.char && open[1].length >= fence.len && line.slice(open[0].length).trim() === "") {
        mask.fill(1, fenceStart, end);
        fence = null;
      }
    } else if (open) {
      fence = { char: open[1][0], len: open[1].length };
      fenceStart = pos;
    } else {
      markCodeSpans(line, pos, mask);
    }
    if (end === text.length) break;
    pos = end + 1;
  }
  if (fence) mask.fill(1, fenceStart, text.length); // an unclosed fence runs to the end
  return mask;
}

function markCodeSpans(line: string, offset: number, mask: Uint8Array) {
  const runs: { at: number; len: number }[] = [];
  for (let i = 0; i < line.length; ) {
    if (line[i] !== "`") {
      i++;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] === "`") j++;
    runs.push({ at: i, len: j - i });
    i = j;
  }
  const next: number[] = new Array(runs.length).fill(-1);
  const lastByLen = new Map<number, number>();
  for (let k = runs.length - 1; k >= 0; k--) {
    next[k] = lastByLen.get(runs[k].len) ?? -1;
    lastByLen.set(runs[k].len, k);
  }
  for (let k = 0; k < runs.length; ) {
    const close = next[k];
    if (close === -1) {
      k++;
      continue;
    }
    mask.fill(1, offset + runs[k].at, offset + runs[close].at + runs[close].len);
    k = close + 1;
  }
}

// Link and footnote definitions ("[a]: url", "[^1]: text") never show on the page themselves.
// A used one without a title is ordinary Markdown; a title, or a definition nothing points to,
// is text only agents see.
const DEFINITION = /^ {0,3}\[(\^?)([^\]\n]{1,200})\]:([^\n]{0,1000})$/gm;
const BRACKETED = /\[(\^?[^\]\n]{1,200})\]/g;
const DEFINITION_TITLE = /[ \t](?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\))[ \t]*$/;
const labelKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Scans a guideline. `privateTerms` are words the author marked as private
 * (project or company names); they are matched case-insensitively as whole words.
 */
export function scanGuideline(text: string, privateTerms: string[] = []): ScanResult {
  const starts = lineStarts(text);
  const findings: Finding[] = [];
  // Within a lane, a span belongs to the first (most severe) rule that matches it.
  // Harmful-instruction checks get their own lane: a personal finding inside a risky
  // line (say, a private word in a curl URL) must never hide that line from review.
  type Lane = "data" | "review" | "info";
  const taken: Record<Lane, Uint8Array> = { data: new Uint8Array(text.length), review: new Uint8Array(text.length), info: new Uint8Array(text.length) };
  const laneOf = (sev: Severity): Lane => (sev === "review" ? "review" : sev === "info" ? "info" : "data");
  const hits = (lane: Lane, s: number, e: number) => {
    const covered = taken[lane];
    for (let i = s; i < e; i++) if (covered[i]) return true;
    return false;
  };

  const add = (rule: string, severity: Severity, start: number, end: number, message: string, placeholder?: string) => {
    const lane = laneOf(severity);
    // Links are only listed when nothing else already covers them.
    const blocked = lane === "info" ? hits("data", start, end) || hits("review", start, end) || hits("info", start, end) : hits(lane, start, end);
    if (end <= start || blocked) return;
    taken[lane].fill(1, start, end);
    const line = lineOf(starts, start);
    findings.push({ id: `${rule}:${start}`, rule, severity, start, end, line, match: text.slice(start, end), message, placeholder });
  };

  const terms = privateTerms.map((t) => t.trim()).filter((t) => t.length >= 2);
  const customRule: Rule[] = terms.length
    ? [{ rule: "private-term", severity: "personal", pattern: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${terms.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "giu"), message: "A word you marked as private", placeholder: "{{PROJECT_NAME}}" }]
    : [];

  // Order matters within the data lane: secrets, then personal data, then the author's
  // private words. A key inside a URL is a key; "acme" inside ayse@acme.com is part of the
  // email, so replacing the email removes both (a separate "acme" would leave "ayse@" behind).
  const code = codeMask(text);
  const by = (sev: Severity) => RULES.filter((r) => r.severity === sev);
  for (const r of [...by("block"), ...by("personal"), ...customRule, ...by("review"), ...by("info")]) {
    r.pattern.lastIndex = 0;
    for (const m of text.matchAll(r.pattern)) {
      if (r.outsideCode && code[m.index ?? 0]) continue;
      const full = m[0];
      const part = r.group ? m[r.group] : full;
      if (part === undefined) continue;
      const start = (m.index ?? 0) + (r.group ? full.indexOf(part) : 0);
      // Sentence punctuation after a path or URL isn't part of it ("…/app." or "…/x,").
      const trimmed = r.severity === "personal" ? part.replace(/[.,;:!?]+$/, "") || part : part;
      const end = start + trimmed.length;
      if (r.accept && !r.accept(trimmed)) continue;
      add(r.rule, r.severity, start, end, r.message, r.placeholder);
    }
  }

  // Definitions the page never shows: titled ones, and ones nothing points to.
  const mentions = new Map<string, number>();
  for (const m of text.matchAll(BRACKETED)) {
    if (code[m.index ?? 0]) continue;
    const key = labelKey(m[1]);
    mentions.set(key, (mentions.get(key) ?? 0) + 1);
  }
  for (const m of text.matchAll(DEFINITION)) {
    const start = m.index ?? 0;
    if (code[start]) continue;
    const footnote = m[1] === "^";
    const used = (mentions.get(labelKey(m[1] + m[2])) ?? 0) >= 2; // itself and at least one other
    const titled = !footnote && DEFINITION_TITLE.test(m[3]);
    if (used && !titled) continue;
    add("hidden-definition", "review", start, start + m[0].length, footnote ? "Footnote nothing points to: the site doesn't show it, but agents read it" : titled ? "Link definition with a title: the site doesn't show it, but agents read it" : "Link definition nothing points to: the site doesn't show it, but agents read it");
  }

  // External links: one info finding per link that no other rule claimed.
  for (const m of text.matchAll(URL_PATTERN)) {
    const start = m.index ?? 0;
    const url = m[0].replace(/[.,;:!?]+$/, "");
    add("external-link", "info", start, start + url.length, "External link");
  }

  findings.sort((a, b) => a.start - b.start);
  const counts: Record<Severity, number> = { block: 0, personal: 0, review: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, counts };
}

// Zero-width characters and bidi controls: invisible, and able to hide or reorder text.
const INVISIBLE = /[​-‍⁠﻿‪-‮⁦-⁩]/g;

/** Removes invisible / direction-changing characters. Returns the clean text and how many were removed. */
export function stripInvisible(text: string): { text: string; removed: number } {
  let removed = 0;
  const clean = text.replace(INVISIBLE, () => {
    removed++;
    return "";
  });
  return { text: clean, removed };
}

export type FileProblem = { kind: "not-markdown" | "binary" | "not-utf8" | "too-large" | "empty"; message: string };

/** Format checks for an uploaded file (K20: a single plain-text .md file). */
export function checkFile(name: string, bytes: Uint8Array): { text?: string; problem?: FileProblem; long: boolean } {
  if (!/\.(md|markdown)$/i.test(name)) return { problem: { kind: "not-markdown", message: "Only .md files can be published." }, long: false };
  if (bytes.length === 0) return { problem: { kind: "empty", message: "This file is empty." }, long: false };
  if (bytes.length > MAX_BYTES) return { problem: { kind: "too-large", message: `This file is ${formatBytes(bytes.length)}. The limit is ${formatBytes(MAX_BYTES)}.` }, long: false };
  if (bytes.includes(0)) return { problem: { kind: "binary", message: "This looks like a binary file, not plain text." }, long: false };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { problem: { kind: "not-utf8", message: "This file isn't valid UTF-8 text." }, long: false };
  }
  return { text: text.replace(/^﻿/, ""), long: bytes.length > WARN_BYTES };
}

export function byteLength(text: string) {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
}

/** Replaces every finding with the given match text by its placeholder. */
export function replaceAll(text: string, match: string, placeholder: string) {
  return text.split(match).join(placeholder);
}

/** Replaces exactly these findings (by offsets), leaving any other copy of the text alone. */
export function replaceFindings(text: string, findings: Pick<Finding, "start" | "end">[], placeholder: string) {
  let out = text;
  for (const f of [...findings].sort((a, b) => b.start - a.start)) out = replaceOne(out, f, placeholder);
  return out;
}

/** Replaces one finding (by offsets) with its placeholder. */
export function replaceOne(text: string, f: Pick<Finding, "start" | "end">, placeholder: string) {
  return text.slice(0, f.start) + placeholder + text.slice(f.end);
}
