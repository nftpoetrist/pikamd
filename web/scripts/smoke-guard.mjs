// Smoke tests drive the dev server, which uses Supabase when web/.env.local sets SUPABASE_URL.
// They rely on the sample guidelines and write likes, which are permanent: never let them run
// against a real database. Reads only the variable names and the project host, never secrets.
import { readFile } from "node:fs/promises";

export async function refuseIfDatabase(name) {
  const env = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "");
  const line = env.split(/\r?\n/).find((l) => /^SUPABASE_URL=\S/.test(l));
  if (!line) return;
  const host = line.slice("SUPABASE_URL=".length).trim().replace(/^https?:\/\//, "");
  console.error(
    `${name}: skipped. The dev server reads guidelines and writes likes to Supabase (${host}) because\n` +
      `web/.env.local sets SUPABASE_URL. This test needs the sample data and writes permanent likes, so it\n` +
      `only runs against the local dev store: remove SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local\n` +
      `(or point them at a separate development project with its own test data) and try again.`,
  );
  process.exit(2);
}
