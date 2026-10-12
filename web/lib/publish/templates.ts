import type { GuidelineKind } from "@/lib/types";

// Accepted kinds (ARCHITECTURE K20) with the label and file convention shown in Publish.
export const KIND_INFO: Record<GuidelineKind, { label: string; hint: string }> = {
  rules: { label: "Rules", hint: "CLAUDE.md, AGENTS.md, .cursor/rules" },
  skill: { label: "Skill", hint: "SKILL.md with frontmatter" },
  prompt: { label: "Prompt", hint: "Command or prompt template" },
  agent: { label: "Agent", hint: ".claude/agents/*.md" },
  guide: { label: "Guide", hint: "How-to for people and agents" },
};

/** Guesses the kind from a file name, e.g. SKILL.md → skill, CLAUDE.shared.md → rules. */
export function kindFromFileName(name: string): GuidelineKind | undefined {
  const n = name.toLowerCase();
  if (/^skill(\.[\w-]+)?\.md$/.test(n)) return "skill";
  if (/^(claude|agents)(\.[\w-]+)?\.md$/.test(n) || n.endsWith(".mdc")) return "rules";
  return undefined;
}

/** First "# Heading" and frontmatter description, to prefill Details. */
export function guessMeta(content: string): { title?: string; description?: string; kind?: GuidelineKind } {
  const front = content.match(/^---\n([\s\S]*?)\n---/);
  const description = front?.[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  const hasTools = !!front?.[1].match(/^tools:/m);
  const title = content.match(/^# (.+)$/m)?.[1].trim();
  const clean = (s?: string) => (s && !s.includes("{{") ? s : undefined);
  return { title: clean(title), description: clean(description), kind: front ? (hasTools ? "agent" : "skill") : undefined };
}

/** "Secure Solidity!" → "secure-solidity" */
export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
