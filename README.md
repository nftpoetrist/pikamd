# PikaMd

A public, non-profit library of Markdown guidelines for AI coding agents: `CLAUDE.md`-style rules,
skills, prompt templates, subagent definitions and guides, shared by the community and recorded on
Arc Network.

- **Share** a guideline: the site checks it for secrets and personal data, pins it to IPFS and your
  own wallet records it on Arc (author, IPFS CID, sha256 of the text).
- **Collect** the ones you like. Your collection belongs to your wallet.
- **Connect your agent** once (Claude Code, Cursor, VS Code, Codex or any MCP client) and it reads
  your collection over MCP, no downloads. Every text it gets is checked against its hash on Arc.
- **Tip authors** in USDC, straight from your wallet to theirs. PikaMd takes no fee and never holds
  funds.

Reading is always free and needs no account. Guidelines are published under CC BY 4.0.

## How it works

| Piece | Where |
|---|---|
| Ownership, versions, content hashes, hiding and moderator locks | `GuidelineRegistry` on Arc |
| Tips | `GuidelineTips` on Arc: USDC goes tipper → author in one call, the recipient is read from the registry |
| The Markdown files | IPFS (Pinata) |
| Search, likes, collections, MCP keys (only their SHA-256), reports | Postgres (Supabase), an index of the chain |
| Site and MCP server (`/mcp`, Streamable HTTP) | Next.js 16 in `web/` |

Arc testnet deployments (both verified on Sourcify):

- `GuidelineRegistry` `0x27cf926771B0A311A9574543ea29dc5e3ea59986`
- `GuidelineTips` `0x81a1A7D604f9771472d5eDE0eF8736b7F75F874a`

## Repository

```
contracts/   Solidity + Foundry (Arc Foundry): GuidelineRegistry, GuidelineTips, tests, deploy scripts
web/         Next.js site, API routes, MCP server, Supabase migrations and tests
design/      scripts that draw the pixel art (mascot, icons, background, social images)
```

`ARCHITECTURE.md`, `DESIGN.md` and `ARC.md` hold every design decision, the design system and the
verified Arc network facts (written in Turkish).

## Run it

```bash
cd web
cp .env.example .env.local   # set PIKAMD_SESSION_SECRET; Supabase and Pinata for publishing
npm install
npm run dev -- -p 3001       # http://localhost:3001
```

Checks: `npm test` (unit and database schema tests), `npm run auth:smoke` and `npm run mcp:smoke`
with the dev server running, and `cd contracts && arc-forge test`. See `web/README.md` and
`contracts/README.md`.

## Security

Found a problem? Report it privately with **Report a vulnerability** on the repository's Security tab,
not in a public issue.

---

Arc is a trademark of Circle Internet Group, Inc. and/or its affiliates. PikaMd is an independent
community project built on Arc.
