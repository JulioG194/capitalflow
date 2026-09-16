# Spec 006: Cloud Deployment (Render + Vercel + Neon)

**Status**: draft
**Author**: Julio
**Created**: 2026-09-14
**Related specs**: 002-auth-users (cookies), 003-market-realtime (WebSocket URL), 004-portfolio, 005-invest-flow

## 1. Context & Motivation

CapitalFlow must be publicly demoable from a single URL for portfolio and interview
purposes. This spec covers the cloud deployment topology: Next.js `apps/web` to Vercel,
NestJS `apps/api` and `apps/market-stream` to Render (free tier), Postgres to Neon,
Redis to Render Redis. All services communicate over public URLs with proper CORS,
cross-site cookies, and TLS. No custom domain — free subdomains only.

## 2. User Stories

- As a portfolio reviewer, I want to open a single URL and register / log in / see the market / place a simulated investment end-to-end.
- As Julio, I want deployments to happen automatically on `git push` to `main`.
- As Julio, I want cold starts on Render free tier to be handled gracefully in the UI, not shown as errors.
- As Julio, I want the CI to run tests and typechecks on every PR before merging.
- As a security-minded reviewer, I want secrets to live only in each platform's env vars, never in git.

## 3. Acceptance Criteria

### Topology & connectivity
- [ ] **AC1**: `apps/web` deploys to Vercel at `https://capitalflow.vercel.app` (or Vercel-assigned name if taken) and returns 200 on `/`.
- [ ] **AC2**: `apps/api` deploys to Render at `https://capitalflow-api.onrender.com` and returns 200 on `GET /health` (once warm).
- [ ] **AC3**: `apps/market-stream` deploys to Render at `https://capitalflow-stream.onrender.com` and returns 200 on `GET /health`.
- [ ] **AC4**: Postgres runs on Neon; `apps/api` connects with `sslmode=require` and pooled connection string.
- [ ] **AC5**: Redis runs on Render (Key-Value / Redis); `apps/market-stream` connects via internal URL when available, else public URL with TLS.
- [ ] **AC6**: End-to-end flow works from the Vercel URL: register → login → view `/app/market` with live ticks → open portfolio → invest → see updated balance.

### CORS & cross-site cookies
- [ ] **AC7**: `apps/api` global CORS allows the exact origins `http://localhost:3000` (dev), the Vercel production URL, AND Vercel preview URLs (regex `https://capitalflow-*.vercel.app`).
- [ ] **AC8**: CORS `credentials: true` is set on the API to allow cookies to be sent.
- [ ] **AC9**: The refresh-token cookie is set with `SameSite=None; Secure; HttpOnly; Path=/auth`. In development, `SameSite=Lax` is used with a separate branch.
- [ ] **AC10**: Socket.io in `apps/market-stream` accepts connections from the same origin list as the API.
- [ ] **AC11**: Frontend fetches from `apps/api` include `credentials: "include"`, and Socket.io client uses `withCredentials: true`.

### CI/CD
- [ ] **AC12**: On push to any branch, GitHub Actions runs: `pnpm typecheck`, `pnpm lint`, `pnpm test`. All must pass before merge to `main`.
- [ ] **AC13**: Vercel auto-deploys `main` to production and every PR to a preview URL.
- [ ] **AC14**: Render auto-deploys `main` on push. `render.yaml` at repo root declares both services as a Blueprint.
- [ ] **AC15**: Database migrations run automatically on `apps/api` deploy via a `preDeployCommand` in `render.yaml`: `pnpm --filter api exec prisma migrate deploy`.
- [ ] **AC16**: A keep-alive workflow in GitHub Actions pings `apps/api/health` and `apps/market-stream/health` every 10 minutes during "portfolio-active" hours (default: enabled — can be toggled by disabling the workflow).

### Configuration & secrets
- [ ] **AC17**: A `.env.example` at the repo root lists every required env var with a short comment and example value. Real `.env*` files are gitignored.
- [ ] **AC18**: `apps/api` and `apps/market-stream` validate env at bootstrap with a Zod schema. Missing or malformed env vars cause the service to exit with a clear error message.
- [ ] **AC19**: `JWT_PRIVATE_KEY_BASE64` and `JWT_PUBLIC_KEY_BASE64` are base64-encoded PEM values. The API decodes them at boot. `apps/market-stream` only needs the public key.
- [ ] **AC20**: `FINNHUB_API_KEY` lives ONLY in `apps/market-stream`'s Render env; `apps/api` does not have it.
- [ ] **AC21**: `DATABASE_URL` lives ONLY in `apps/api`'s Render env.
- [ ] **AC22**: All Vercel env vars scoped correctly: `NEXT_PUBLIC_*` for client-side (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STREAM_URL`); private vars for server-side only.

### Cold start UX
- [ ] **AC23**: When the frontend receives a network error, 502, or 503 from the API within the first 60s of the session, it shows a non-blocking banner: "The service is waking up… (~30s)". Banner disappears on first successful request.
- [ ] **AC24**: When Socket.io connection to `apps/market-stream` fails initially, the market page shows a "conectando…" indicator instead of an error state, and retries with exponential backoff (max 60s).
- [ ] **AC25**: The `/health` endpoint on `apps/api` returns 200 with `{ status: "ok", uptime, db: "ok" | "error" }`. It does NOT require auth. It returns 503 if DB is unreachable.
- [ ] **AC26**: The `/health` endpoint on `apps/market-stream` returns 200 with `{ status: "ok", uptime, redis: "ok" | "error", finnhub: "connected" | "disconnected" }`.

### Forgot-password without email
- [ ] **AC27**: `POST /auth/forgot-password` in production logs the reset link to stdout with a structured log line: `[password-reset] user=<email> link=<url>`.
- [ ] **AC28**: In non-production (`NODE_ENV !== "production"`), the same endpoint additionally returns `{ resetLink: string, message: "Development mode: link not emailed" }` in the response body. Frontend detects this and shows the link in a toast for local dev only.
- [ ] **AC29**: The README explicitly documents that this is a portfolio project with no real email sending, and points to the Render logs as the way to retrieve reset links in the demo.

### Documentation
- [ ] **AC30**: Root `README.md` includes: live demo URL, quick-start local dev instructions, architecture diagram (Mermaid), env var table, cold-start note, "how to demo" section for reviewers.
- [ ] **AC31**: `infra/DEPLOY.md` documents the manual one-time setup: creating the Neon DB, creating the Render services, configuring env vars, connecting the GitHub repo to Vercel.
- [ ] **AC32**: Every deployment platform's dashboard link is listed in `infra/DEPLOY.md` for future maintenance.

### Observability minimum
- [ ] **AC33**: All backend logs are structured JSON with `timestamp`, `level`, `service`, `msg`, and request-scoped `requestId`.
- [ ] **AC34**: A single log line per HTTP request in `apps/api` with method, path, status, duration, userId (when authenticated).

## 4. Technical Contracts

### Deployment topology
```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│  ┌────────────────────────────────────────────────┐          │
│  │ apps/web (Next.js 15)                          │          │
│  │ https://capitalflow.vercel.app                 │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (credentials: include)
                           │ WSS
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌────────────────────┐              ┌────────────────────┐
│   Render (free)    │              │   Render (free)    │
│   apps/api         │              │   apps/market-     │
│   NestJS 11        │              │   stream (NestJS)  │
│   *.onrender.com   │              │   *.onrender.com   │
└─────────┬──────────┘              └─────────┬──────────┘
          │                                   │
          ▼                                   ▼
    ┌───────────┐                     ┌──────────────┐
    │  Neon     │                     │  Redis on    │
    │  Postgres │                     │  Render      │
    └───────────┘                     └──────────────┘
                                             ▲
                                             │ single WS
                                             │
                                     ┌──────────────┐
                                     │  Finnhub API │
                                     └──────────────┘
```

### `render.yaml` (Blueprint at repo root)

> **Naming note (post-implementation correction, 2026-09-15)**: the actual
> `render.yaml` at the repo root uses the env var names apps/api and
> apps/market-stream really read (`JWT_ACCESS_PRIVATE_KEY`,
> `JWT_ACCESS_PUBLIC_KEY`, `WEB_APP_ORIGIN`) rather than the illustrative
> `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` / `WEB_ORIGIN` shown
> below — a deliberate choice to avoid an env-var rename across both
> services' code (see `infra/DEPLOY.md`'s "Naming note"). This block below
> is also corrected from the original draft: apps/api's own
> `src/config/env.schema.ts` requires `REDIS_URL` (apps/api reads cached
> prices from it) and `PASSWORD_RESET_TTL_MINUTES` (no default) — both were
> missing from the original example, which would have failed apps/api's
> AC18 fail-fast validation at boot. `STREAM_INTERNAL_URL` was dropped:
> apps/api never calls apps/market-stream directly (per this file's
> External dependencies section), so nothing reads it.

```yaml
services:
  - type: web
    name: capitalflow-api
    env: node
    region: oregon
    plan: free
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter api exec prisma generate && pnpm --filter api build
    startCommand: pnpm --filter api start:prod
    preDeployCommand: pnpm --filter api exec prisma migrate deploy
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        fromService:
          type: redis
          name: capitalflow-redis
          property: connectionString
      - key: JWT_ACCESS_PRIVATE_KEY
        sync: false
      - key: JWT_ACCESS_PUBLIC_KEY
        sync: false
      - key: PASSWORD_RESET_TTL_MINUTES
        value: "30"
      - key: WEB_APP_ORIGIN
        value: https://capitalflow.vercel.app
      - key: WEB_PREVIEW_ORIGIN_REGEX
        value: ^https://capitalflow-[a-z0-9-]+\.vercel\.app$

  - type: web
    name: capitalflow-stream
    env: node
    region: oregon
    plan: free
    buildCommand: pnpm install --frozen-lockfile && pnpm --filter market-stream build
    startCommand: pnpm --filter market-stream start:prod
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        fromService:
          type: redis
          name: capitalflow-redis
          property: connectionString
      - key: JWT_ACCESS_PUBLIC_KEY
        sync: false
      - key: FINNHUB_API_KEY
        sync: false
      - key: WEB_APP_ORIGIN
        value: https://capitalflow.vercel.app
      - key: WEB_PREVIEW_ORIGIN_REGEX
        value: ^https://capitalflow-[a-z0-9-]+\.vercel\.app$

  - type: redis
    name: capitalflow-redis
    plan: free
    ipAllowList: []
    maxmemoryPolicy: allkeys-lru
```

### GitHub Actions workflows

`.github/workflows/ci.yml` — runs on every push and PR:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

`.github/workflows/keepalive.yml` — pings services every 10 min:
```yaml
name: Keep-alive
on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS https://capitalflow-api.onrender.com/health || true
          curl -fsS https://capitalflow-stream.onrender.com/health || true
```

### Environment variables

**`apps/api` (Render):**
- `DATABASE_URL` — Neon pooled connection string with `sslmode=require`
- `JWT_PRIVATE_KEY_BASE64` — base64 of RS256 private PEM
- `JWT_PUBLIC_KEY_BASE64` — base64 of RS256 public PEM
- `WEB_ORIGIN` — `https://capitalflow.vercel.app`
- `WEB_PREVIEW_ORIGIN_REGEX` — `^https://capitalflow-[a-z0-9-]+\.vercel\.app$`
- `NODE_ENV` — `production`
- `PORT` — provided by Render

**`apps/market-stream` (Render):**
- `REDIS_URL` — internal Render Redis URL
- `JWT_PUBLIC_KEY_BASE64` — same public PEM as API
- `FINNHUB_API_KEY` — from finnhub.io dashboard
- `WEB_ORIGIN` — `https://capitalflow.vercel.app`
- `WEB_PREVIEW_ORIGIN_REGEX` — same regex as API
- `NODE_ENV` — `production`
- `PORT` — provided by Render

**`apps/web` (Vercel):**
- `NEXT_PUBLIC_API_URL` — `https://capitalflow-api.onrender.com`
- `NEXT_PUBLIC_STREAM_URL` — `https://capitalflow-stream.onrender.com`
- `NODE_ENV` — `production` (Vercel sets automatically)

### Health check contract (both backend services)
```ts
// GET /health — no auth required
type HealthResponse = {
  status: "ok" | "degraded";
  uptime: number;   // seconds
  service: "api" | "market-stream";
  version?: string; // git SHA if available
  db?: "ok" | "error";        // api only
  redis?: "ok" | "error";     // market-stream only
  finnhub?: "connected" | "disconnected"; // market-stream only
};
```

Returns 200 when `status: "ok"`, 503 when `status: "degraded"`.

### CORS configuration (both backend services)
```ts
// apps/api/src/main.ts
const previewRegex = new RegExp(process.env.WEB_PREVIEW_ORIGIN_REGEX!);
app.enableCors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, health checks
    if (origin === "http://localhost:3000") return cb(null, true);
    if (origin === process.env.WEB_ORIGIN) return cb(null, true);
    if (previewRegex.test(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
});
```

### Cookie config for cross-site
```ts
// apps/api/src/modules/auth/auth.service.ts (refresh cookie set)
res.cookie("refresh_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

## 5. Edge Cases & Errors

- **Cold start on first user request**: frontend shows the "servicio despertando" banner (AC23). No user-facing error state.
- **Neon connection pool exhaustion**: use Neon's pooled connection string (port 6432, not 5432). Prisma with `?pgbouncer=true&connection_limit=1` in Serverless mode.
- **Render Redis eviction**: `maxmemoryPolicy: allkeys-lru` — oldest cached prices evicted first. Acceptable for the simulator.
- **Vercel preview URL not matching regex**: log the rejected origin and adjust regex — never disable CORS.
- **Finnhub disconnect**: `apps/market-stream` reconnects with exponential backoff. `/health` reports `finnhub: disconnected` during the outage. Frontend does not surface this — it just shows last cached prices.
- **JWT key mismatch across services**: if `apps/api` and `apps/market-stream` have different `JWT_PUBLIC_KEY_BASE64` values, Socket.io auth fails silently. `/health` on market-stream should include a `jwtValidated: boolean` field on startup verification.
- **GitHub Actions keep-alive rate limits**: 10 min interval is well within GitHub Actions limits. If pings start failing, the workflow logs but doesn't fail the run (`|| true`).
- **Environment drift between local and prod**: Zod schema validation at bootstrap surfaces missing vars immediately.

## 6. Out of Scope

- Custom domain (`capitalflow.dev` etc.) — deferred; using free subdomains
- Real email sending (Resend/SendGrid) — spec 007 if ever needed
- Self-hosted deployment (Docker + Nginx + VPS) — alternative spec 009 if ever wanted
- Monitoring (Sentry, Datadog, Grafana) — future spec
- Analytics (Plausible, GA) — future spec
- Multi-region deployment
- Autoscaling / paid tiers
- Blue-green or canary deployments
- Database backups beyond Neon's default retention
- Cost alerts / billing dashboards
- Preview deployments for backend services (Render preview envs require paid plan)

## 7. Implementation Notes

- **RSA key pair generation** (do this locally, keep private key OUT of git):
  ```bash
  openssl genrsa -out private.pem 2048
  openssl rsa -in private.pem -pubout -out public.pem
  base64 -i private.pem | tr -d '\n' > private.b64
  base64 -i public.pem | tr -d '\n' > public.b64
  ```
  Paste the base64 strings into Render env vars.

- **Neon connection string** format:
  `postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require&pgbouncer=true`
  Use the "pooled" connection string, not the direct one.

- **Vercel monorepo setup**: in Vercel project settings, set Root Directory to `apps/web`. Install Command: `cd ../.. && pnpm install --frozen-lockfile`. Build Command: `cd ../.. && pnpm --filter web build`. Output Directory: leave default.

- **Render Blueprint apply**: connect the GitHub repo in Render dashboard, choose "Blueprint", and Render reads `render.yaml`. First deploy requires manually pasting the `sync: false` env vars in the dashboard.

- **First deploy order**: Neon → Render Redis → Render api (paste envs, deploy, verify /health) → Render market-stream → Vercel web (paste envs pointing at Render URLs) → verify E2E.

## 8. Validation Plan

### Automated
- **CI** (per AC12): `pnpm typecheck && pnpm lint && pnpm test` on every PR. Green required to merge.
- **Post-deploy smoke test** (GitHub Actions manual workflow): `curl` against production `/health` endpoints and root landing page. Reports pass/fail.

### Manual (post-deploy checklist in `infra/DEPLOY.md`)
1. Open `https://capitalflow.vercel.app` — landing renders, Lighthouse SEO still 100.
2. Register a new user — success, redirected to `/app/market`.
3. Cold-start banner appears within the first 30s if the API was asleep — disappears once warm.
4. Market page shows live ticks within 30s of the app warming.
5. Portfolio page shows `$10,000.00` initial simulated cash.
6. Invest $500 in AAPL — modal shows success — portfolio updates.
7. Log out — session cookie cleared — redirected to `/`.
8. Log in again with same credentials — restored.
9. Trigger `/auth/forgot-password` in prod — check Render logs, retrieve link, complete reset.
10. Preview PR deploy: open a PR, wait for Vercel preview URL, verify CORS accepts it.

### Security spot-check
- `curl https://capitalflow-api.onrender.com/health` — no auth required, returns 200.
- `curl -X POST https://capitalflow-api.onrender.com/portfolio/invest` — returns 401 Unauthorized.
- Response headers on `apps/api`: `Access-Control-Allow-Credentials: true`, correct `Access-Control-Allow-Origin`.
- No secrets in the git repo (`git log -p | grep -iE "PRIVATE_KEY|API_KEY|DATABASE_URL"` returns nothing).
