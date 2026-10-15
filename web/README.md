# PikaMd web

The PikaMd site and MCP server: a public, non-profit library of Markdown guidelines for AI agents
(CLAUDE.md rules, skills, prompts, subagents, guides) on Arc. Architecture and decisions live in
`../ARCHITECTURE.md`, the design system in `../DESIGN.md`, verified Arc network facts in `../ARC.md`.

Status (2026-10-15): works end to end on Arc testnet, not deployed yet. Publishing is real: the
server checks the file, pins it to IPFS (Pinata), the author's wallet registers it in the
`GuidelineRegistry` contract, and the server reads the receipt and indexes it in Supabase. Wallet
sign-in (SIWE), likes and PikaGold run on Supabase; an indexer keeps hides and moderator locks in
step with the chain. The MCP server (`/mcp`) serves search and reading and checks every text
against its on-chain hash. MCP keys and My Collection are still a local demo. The security review
of 2026-10-15 is in `../ARCHITECTURE.md` §9.4.

## Run it

```bash
cp .env.example .env.local   # then set PIKAMD_SESSION_SECRET (32+ random characters)
npm install
npm run dev -- -p 3001       # http://localhost:3001
```

Without `SUPABASE_URL` the dev server uses a local store and the sample guidelines; publishing
needs Supabase and Pinata. Next.js 16 differs from older versions: read
`node_modules/next/dist/docs/` before changing framework code.

## Check it

Enable the secret guard once per clone: `git config core.hooksPath .githooks` (blocks commits that
add keys, JWTs, Supabase tokens or filled secret env vars; prints only the file and the rule).

```bash
npx tsc --noEmit
npx eslint app components lib scripts supabase
npm test                     # unit + schema tests: scanner (incl. timed adversarial files), MCP,
                             # SIWE/session, likes, search, publish, migrations on PGlite
npm run mcp:smoke            # needs the dev server: MCP over HTTP with the official client
npm run auth:smoke           # needs the dev server: sign-in, likes, unlikes, PikaGold, CSRF
# Both need the sample data. With the local dev store (no SUPABASE_URL) they just run. With the
# development Supabase project, seed it once (npm run db:seed); auth:smoke clears its test
# wallets' likes and the rate-limit counters. Both refuse the LIVE project (scripts/smoke-guard.mjs).
npx next build && npx next typegen
```

## Environment

See `.env.example`. Never commit `.env*` files or `.data/` (local dev store).

| Variable | Where | What |
|---|---|---|
| `PIKAMD_SESSION_SECRET` | server | Signs session cookies, sign-in nonces and hashed IPs for rate limits. Changing it signs everyone out |
| `NEXT_PUBLIC_ARC_NETWORK` | both | `testnet` (default) or `mainnet` |
| `NEXT_PUBLIC_ARC_RPC_URL` | browser | Optional keyed, domain-restricted RPC; also allowed by the CSP |
| `ARC_RPC_URL` | server | Optional RPC for receipts, the indexer and smart-wallet signature checks |
| `ARC_LOGS_MAX_RANGE` | server | Optional: blocks per `eth_getLogs` call (default 10,000, the testnet RPC's limit) |
| `PIKAMD_ALLOWED_HOSTS` | server | Deployed hostnames allowed to reach `/mcp` (localhost always is). Without it `/mcp` answers 403 in production |
| `CRON_SECRET` | server | Production: Vercel's daily cron sends it as a bearer token to `/api/cron/indexer` |
| `SUPABASE_URL` | server | Supabase project URL |
| `SUPABASE_SECRET_KEY` | server | Supabase secret key (`sb_secret_…`); bypasses RLS, server only |
| `PINATA_JWT` | server | Pinata key with Files: Write; uploads go to the public IPFS network |
| `PINATA_GATEWAY` | server | The Pinata gateway domain, without `https://` |
| `SUPABASE_ACCESS_TOKEN_DEV` / `_LIVE` | local only | Scoped Supabase tokens (Database: Read-write) for `npm run db:migrate`. Never on Vercel |

## Database

Two Supabase projects: **live** (`sdjsvemkchgonznhbuku`, used by the deployed testnet site, keys only
in Vercel) and **development** (`bvtmtkkscseouplfinvj`, used by localhost through `.env.local`).
`npm run db:seed` fills the development project with the sample guidelines; it refuses the live one.

`supabase/migrations/*.sql` holds the schema. `npm run db:migrate` applies the pending files to the
development project in order through the Supabase Management API, one transaction per file, and
records them in `public.schema_migrations`; after the tests pass, `npm run db:migrate -- live` does
the same for the live project (`-- --status` only lists). Every table has RLS on with no policies
and the public roles get no privileges, so only the server (secret key) can read or write.
`supabase/schema.test.mjs` runs every migration on PGlite in `npm test`.

## Deploying (Vercel)

- Environment: the live Supabase URL and secret key, Pinata, a new `PIKAMD_SESSION_SECRET`,
  `CRON_SECRET` and `PIKAMD_ALLOWED_HOSTS` (the site's hostname).
- Firewall: one rate-limit rule (the Hobby plan allows one) for requests to `/api/` and `/mcp`, by
  IP. The write endpoints also have their own limits in the database (`lib/server/ratelimit.ts`).
- `vercel.json` runs the indexer once a day (the Hobby plan's cron limit); publishing and visits to
  Explore keep it current in between.
