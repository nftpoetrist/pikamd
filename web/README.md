# PikaMd web

The PikaMd site and MCP server: a public, non-profit library of Markdown guidelines for AI agents
(CLAUDE.md rules, skills, prompts, subagents, guides) on Arc. Architecture and decisions live in
`../ARCHITECTURE.md`, the design system in `../DESIGN.md`, verified Arc network facts in `../ARC.md`.

Status: the UI runs on mock data. Wallet sign-in (SIWE), likes and PikaGold work against a local
dev store; production has no store yet, so those routes answer 503 there. The guideline registry
contract and the real backend (Supabase + IPFS) are not built yet.

## Run it

```bash
cp .env.example .env.local   # then set PIKAMD_SESSION_SECRET (32+ random characters)
npm install
npm run dev -- -p 3001       # http://localhost:3001
```

Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before changing
framework code.

## Check it

Enable the secret guard once per clone: `git config core.hooksPath .githooks` (blocks commits that
add keys, JWTs or filled secret env vars; prints only the file and the rule).

```bash
npx tsc --noEmit
npx eslint app components lib scripts
npm test                     # unit tests (scan, MCP, SIWE/session, likes, search)
npm run mcp:smoke            # needs the dev server: MCP over HTTP with the official client
npm run auth:smoke           # needs the dev server: wallet sign-in, likes, PikaGold
# Both need the sample data. With the local dev store (no SUPABASE_URL) they just run. With the
# development Supabase project, seed it once (npm run db:seed); auth:smoke clears its test
# wallets' likes before and after. Both refuse the LIVE project (scripts/smoke-guard.mjs).
npx next build
```

## Environment

See `.env.example`. Never commit `.env*` files or `.data/` (local dev store).

| Variable | Where | What |
|---|---|---|
| `PIKAMD_SESSION_SECRET` | server | Signs session cookies. Changing it signs everyone out |
| `NEXT_PUBLIC_ARC_NETWORK` | both | `testnet` (default) or `mainnet` |
| `NEXT_PUBLIC_ARC_RPC_URL` | browser | Optional keyed, domain-restricted RPC; also allowed by the CSP |
| `ARC_RPC_URL` | server | Optional RPC for smart-wallet signature checks |
| `PIKAMD_ALLOWED_HOSTS` | server | Deployed hostnames allowed to reach `/mcp` (localhost always is) |
| `SUPABASE_URL` | server | Supabase project URL |
| `SUPABASE_SECRET_KEY` | server | Supabase secret key (`sb_secret_…`); bypasses RLS, server only |

## Database

Two Supabase projects: **live** (`sdjsvemkchgonznhbuku`, used by the deployed testnet site, keys only
in Vercel) and **development** (`bvtmtkkscseouplfinvj`, used by localhost through `.env.local`).
`npm run db:seed` fills the development project with the sample guidelines; it refuses the live one.

`supabase/migrations/*.sql` holds the schema. Run each file once, in order, in the Supabase SQL
editor. Every table has RLS on with no policies and the public roles get no privileges, so only the
server (secret key) can read or write. `supabase/schema.test.mjs` runs the migration on PGlite in `npm test`.
