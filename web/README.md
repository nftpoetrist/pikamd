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

```bash
npx tsc --noEmit
npx eslint app components lib scripts
npm test                     # unit tests (scan, MCP, SIWE/session, likes, search)
npm run mcp:smoke            # needs the dev server: MCP over HTTP with the official client
npm run auth:smoke           # needs the dev server: wallet sign-in, likes, PikaGold
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
