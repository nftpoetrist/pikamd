// Sample "Tested with" lists so the card's note can be seen on the dev server. Not real data and
// never used in production; the feature has no storage yet.
const SAMPLE: Record<string, string[]> = {
  test2: ["Claude Code", "Cursor"],
  "nextjs-app-router": ["Claude Code", "Cursor", "Codex"],
  "secure-solidity": ["Claude Code"],
  "code-review-checklist": ["Codex", "VS Code"],
  "conventional-commits": ["Cursor"],
};

export const previewTestedWith = (slug: string): string[] | undefined =>
  process.env.NODE_ENV === "production" ? undefined : SAMPLE[slug];
