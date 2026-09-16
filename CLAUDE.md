# CapitalFlow — Investment Simulator (Portfolio Project)

Educational investment simulator built as an AI-native engineering portfolio project.
Users track simulated portfolios, view real market data (delayed), and practice
investment decisions **without risking real money**.

> **CRITICAL CONTEXT: this is a SIMULATOR, not a real-money investment product.**
> No real funds are held, transferred, or invested. All balances, transactions,
> and returns are simulated. The UI, landing copy, README, and Terms of Service
> must make this clear at all times. A persistent "Simulator mode" badge is shown
> in the authenticated app.

## Purpose

This repository is BOTH:
1. A functioning investment simulator.
2. A **demonstration of AI-native engineering** — Spec-Driven Development (SDD),
   Claude Code with subagents, human-in-the-loop review. The git history is
   deliberately shaped to tell that story for portfolio / interview review.

## Stack

- **Repo**: pnpm workspaces + Turborepo
- **Web**: Next.js 15 App Router, TypeScript strict, Tailwind, Vitest, Playwright
- **API**: NestJS 11, TypeScript strict, Prisma, PostgreSQL, Jest
- **Market Stream**: NestJS 11, Socket.io, Redis, Finnhub API (free tier, 15-min delayed)
- **Shared**: `packages/shared-types` — DTOs, zod schemas, TS types across apps
- **Infra**: Docker Compose, Nginx reverse proxy, deployable to any VPS
- **Node**: v22 (see `.nvmrc`)
- **Package manager**: pnpm only (never npm/yarn)

## Project layout

- `apps/web` — Next.js. Contains BOTH the public landing (SEO-optimized: `/`, `/about`, `/how-it-works`, `/pricing`) AND the authenticated platform (`/app/market`, `/app/portfolio`, `/app/invest`). Route groups `(marketing)` and `(app)` separate them.
- `apps/api` — NestJS backend for auth, portfolios, transactions, and user data.
- `apps/market-stream` — Dedicated NestJS service. Holds a single upstream WebSocket to Finnhub, caches last prices in Redis, and fans out to clients via Socket.io.
- `packages/shared-types` — Imported as `@capitalflow/shared-types` by all apps.
- `specs/` — Feature specifications (SDD). One numbered file per feature.
- `infra/` — Docker Compose, Nginx config, deployment scripts.
- `.claude/` — Claude Code subagents (`.claude/agents/`) and slash commands (`.claude/commands/`).

## External dependencies

- **Finnhub** (free tier): market data. 60 req/min, 15-minute delayed quotes.
  - **Only `apps/market-stream` holds the API key and talks to Finnhub.** No other service calls it directly.

## Development workflow: Spec-Driven Development

Every feature with business logic requires a spec in `specs/NNN-name.md` BEFORE implementation.

The cycle:

1. **Specify** — Draft `specs/NNN-name.md` using `specs/_template.md`. Invoke `/spec <name>` or the `spec-writer` subagent.
2. **Review spec** — Verify acceptance criteria, edge cases, and out-of-scope are explicit. A spec you can't verify is a bad spec.
3. **Plan** — Invoke `/implement specs/NNN-name.md` and request a plan first, no code. The agent lists files, order, and validation approach.
4. **Review plan** — Approve or push back before code is written.
5. **Execute** — Agent implements, stopping per acceptance-criterion block for review.
6. **Verify** — Invoke `/review specs/NNN-name.md`. `code-reviewer` subagent checks each AC.
7. **Validate** — `pnpm test`, `pnpm typecheck`, `pnpm lint`. Fix anything that fails before merging.

Specs are living documents. If implementation reveals the spec was wrong, update
the spec in the SAME commit as the code fix. A stale spec is worse than no spec.

Commits happen per acceptance-criterion block, not per file. Commit messages
reference the spec: `feat(landing): AC1-AC7 content structure (spec 001)`.

## Conventions

### TypeScript
- `strict: true` everywhere; no `any`; prefer `unknown` + narrowing.
- Shared DTOs and zod schemas live in `@capitalflow/shared-types`, never duplicated per app.
- Monetary values: `Decimal` (Prisma) in DB; strings in transit; never JS `number` for money.

### Backend (NestJS)
- Feature-module structure: `src/modules/<feature>/{controller,service,dto,entities}`.
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Errors: domain exceptions mapped to HTTP via filters; never leak Prisma errors to clients.
- Config: `@nestjs/config` + Zod schema validation; fail fast on missing env.
- Auth: self-contained JWT (RS256) + refresh token rotation. Access 15 min, refresh 7 days.

### Frontend (Next.js)
- Server Components by default; `"use client"` only when required (state, events, browser APIs). Every `"use client"` gets a one-line comment explaining why.
- Landing (`app/(marketing)/*`): static/ISR, fully server-rendered for SEO.
- Platform (`app/(app)/*`): protected by middleware; can be client-heavy for real-time data.
- Forms: `react-hook-form` + zod resolver; zod schemas reused from `shared-types`.
- Styling: Tailwind, design tokens in `tailwind.config.ts`, no inline CSS.

### Database (Prisma)
- One migration per PR, descriptive name (`add_users_table`, not `update`).
- Never edit existing migrations; always create new ones.
- Seed data in `apps/api/prisma/seed.ts`.

### Simulator transparency (non-negotiable)
- README states "educational simulator" in the first paragraph.
- Landing pages explicitly state "Educational investment simulator".
- Platform shows a persistent "Simulator mode" badge in the nav.
- Terms of Service state no real money is involved.
- No copy anywhere promises "guaranteed returns" or "profits".

### Git
- Conventional commits: `feat(scope): ...`, `fix(scope): ...`, `docs(spec): ...`, `chore: ...`.
- PR / commit description references the spec: `Implements specs/001-landing-seo.md, AC1–AC7`.
- Repo is public on GitHub from day one. Commits are portfolio evidence.

## Commands

- `pnpm dev` — run web + api + market-stream in parallel
- `pnpm build` — build all apps
- `pnpm test` — all tests
- `pnpm typecheck` — typecheck everything
- `pnpm lint` — lint everything
- `pnpm --filter api prisma migrate dev --name <name>` — new migration

## What NOT to do

- Don't implement real-money flows. This is a simulator.
- Don't promise returns or profits in any copy or UI text.
- Don't call Finnhub from anywhere other than `apps/market-stream`.
- Don't use `any`, `@ts-ignore`, or disable lint rules without a comment explaining why.
- Don't commit `.env`, secrets, or API keys.
- Don't skip the spec → plan → review cycle for business-logic features. The workflow IS the portfolio.
- Don't write code before reading the relevant spec and CLAUDE.md.
