// Why someone reports a guideline (web/supabase/migrations/20261018120000_moderation.sql keeps the
// same codes). Shared by the report dialog, the API and the moderation page.
export const REPORT_REASONS = [
  { code: "harmful", label: "Harmful instructions", hint: "It tells agents to do something dangerous, like running unknown code or sending data away" },
  { code: "secrets", label: "Leaks secrets", hint: "API keys, passwords, private keys or tokens" },
  { code: "personal", label: "Personal information", hint: "Someone's email, phone, address or other private details" },
  { code: "copyright", label: "Copied without permission", hint: "The author doesn't have the right to share it" },
  { code: "spam", label: "Spam or ads", hint: "Promotion, junk or not a guideline at all" },
  { code: "illegal", label: "Illegal content", hint: "Content that breaks the law" },
  { code: "other", label: "Something else", hint: "Tell us what's wrong in the note" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["code"];

export const NOTE_MAX = 500;

export const isReason = (v: unknown): v is ReportReason => typeof v === "string" && REPORT_REASONS.some((r) => r.code === v);

export const reasonLabel = (code: string) => REPORT_REASONS.find((r) => r.code === code)?.label ?? code;
