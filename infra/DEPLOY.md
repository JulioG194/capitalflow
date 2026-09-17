# Deploying CapitalFlow (spec 006)

One-time manual setup for the Neon + Render + Vercel topology described in
[`specs/006-deployment-cloud.md`](../specs/006-deployment-cloud.md). After
this setup, `git push` to `main` auto-deploys all three services (AC13/AC14).

## Prerequisites before you start

- A GitHub remote for this repo (Render and Vercel both deploy from it).
- Local RSA key pair for JWT signing (see step 3) — generate it once, reuse
  across environments.
- These steps assume the cloud-deployment code changes for spec 006 have
  landed: CORS allowlist (`WEB_APP_ORIGIN` + `WEB_PREVIEW_ORIGIN_REGEX`,
  AC7/AC10), cross-site cookie config (AC9), `GET /health` on both
  `apps/api` and `apps/market-stream`. Until then, the Render health checks
  below will fail. Check the relevant spec AC blocks are implemented and
  merged before running a first deploy.

## Naming note

`render.yaml` and this doc use the env var names actually read by
`apps/api`/`apps/market-stream` today (`JWT_ACCESS_PRIVATE_KEY`,
`JWT_ACCESS_PUBLIC_KEY`, `WEB_APP_ORIGIN`) rather than spec 006 section 4's
illustrative `JWT_PRIVATE_KEY_BASE64` / `WEB_ORIGIN` names. `WEB_PREVIEW_ORIGIN_REGEX`
is read by both services' env schemas (AC7/AC10) and is OPTIONAL with NO
default — leave it unset in an environment to allow zero preview origins
(fail closed), or set it to enable Vercel preview-deploy CORS/Socket.io
access.

---

## 1. Create the Neon Postgres database

1. Dashboard: <https://console.neon.tech>
2. Create a new project (any region close to Render's `oregon` region to
   minimize latency).
3. Create a database (e.g. `capitalflow`).
4. Copy the **pooled** connection string (port `6432`, not `5432`), of the
   form:
   ```
   postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/capitalflow?sslmode=require&pgbouncer=true
   ```
   This is `DATABASE_URL` for `apps/api`. Do not use the direct (non-pooled)
   connection string — Render's free tier has no persistent connection
   pooling of its own, and Neon's serverless Postgres can exhaust its
   connection limit quickly without the pooler.

## 2. Create the Render services

1. Dashboard: <https://dashboard.render.com>
2. **New > Blueprint**, connect this repo's GitHub remote. Render reads
   `render.yaml` at the repo root and proposes three resources:
   `capitalflow-api`, `capitalflow-stream`, `capitalflow-redis`.
3. Apply the Blueprint. The first deploy will fail (or sit incomplete) until
   the `sync: false` env vars below are pasted in manually — that's
   expected.
4. For **capitalflow-api**, open its Environment tab and set:
   - `DATABASE_URL` — the Neon pooled string from step 1.
   - `JWT_ACCESS_PRIVATE_KEY`, `JWT_ACCESS_PUBLIC_KEY` — from step 3 below.
   - (`REDIS_URL`, `NODE_ENV`, `WEB_APP_ORIGIN`, `WEB_PREVIEW_ORIGIN_REGEX`,
     `PASSWORD_RESET_TTL_MINUTES` are already set by `render.yaml`.)
5. For **capitalflow-stream**, set:
   - `JWT_ACCESS_PUBLIC_KEY` — the *same* public key as capitalflow-api.
   - `FINNHUB_API_KEY` — from your Finnhub dashboard (free tier).
6. Trigger a manual deploy on both services once their env vars are set.
   Watch the logs; `capitalflow-api`'s `startCommand` runs
   `pnpm --filter api exec prisma migrate deploy` before Nest starts (free
   tier does not support `preDeployCommand`).
7. Verify both are up:
   ```
   curl -i https://capitalflow-api.onrender.com/health
   curl -i https://capitalflow-stream.onrender.com/health
   ```
   First request after idle may take ~30s (free-tier cold start) — this is
   the condition the frontend's cold-start banner (AC23) is built for.

## 3. Generate the JWT RSA key pair (once, locally)

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Paste the raw PEM contents (with real newlines converted to literal `\n`,
matching the `.env.example` convention) into `JWT_ACCESS_PRIVATE_KEY` /
`JWT_ACCESS_PUBLIC_KEY` on Render — for both services. **Keep `private.pem`
out of git.** `apps/market-stream` only ever needs the public key (spec 006
AC19 / spec 003 section 7) — it verifies tokens, never signs them.

## 4. Connect apps/web to Vercel

1. Dashboard: <https://vercel.com/dashboard>
2. **Add New > Project**, import this repo.
3. Project Settings:
   - **Root Directory**: `apps/web`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
   - **Build Command**: `cd ../.. && pnpm --filter @capitalflow/shared-types build && pnpm --filter web build`
   - **Output Directory**: leave default
   - **Node.js Version**: set to **22.x** under Settings > General. There is
     no `vercel.json` or `engines` field in `apps/web/package.json` pinning
     this — it must match `.nvmrc`/CI (Node 22) by hand in the dashboard, or
     the build environment will drift from local/CI and can hit the same
     `undici`/`jsdom` Node-version incompatibility that Node 20 did.
4. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_API_URL` — **leave empty / unset** (same-origin rewrites).
   - `API_UPSTREAM_URL` — `https://capitalflow-api.onrender.com` (server-only;
     used by `apps/web/next.config.ts` rewrites so auth cookies are set on
     the Vercel host, not on Render).
   - `NEXT_PUBLIC_MARKET_STREAM_URL` — `https://capitalflow-stream.onrender.com`
5. Deploy. Vercel auto-deploys `main` to production and every PR to a
   preview URL (AC13) — no further config needed.
6. Once you have the real Vercel URL, go back to Render and update
   `WEB_APP_ORIGIN` on both `capitalflow-api` and `capitalflow-stream` if it
   differs from `https://capitalflow.vercel.app` (Vercel appends a suffix
   when that name is taken). Also pin **Node.js Version → 22.x** under
   Settings > General (match `.nvmrc` / CI).

## 5. First deploy order

Neon → Render Redis → Render `capitalflow-api` (env vars, deploy, verify
`/health`) → Render `capitalflow-stream` (env vars, deploy, verify
`/health`) → Vercel `apps/web` (env vars pointing at the two Render URLs) →
verify the end-to-end flow (register → login → market → portfolio →
invest) from the Vercel URL.

## 6. Post-deploy checklist

1. Open the Vercel URL — landing renders.
2. Register a new user — redirected to `/app/market`.
3. If the API was asleep, the cold-start banner appears within ~30s and
   disappears once warm.
4. Market page shows live ticks within 30s of the stream service warming.
5. Portfolio page shows `$10,000.00` initial simulated cash.
6. Invest $500 in AAPL — success — portfolio updates.
7. Log out — cookie cleared — redirected to `/`.
8. Log in again with the same credentials — restored.
9. Trigger `/auth/forgot-password` in prod — check Render's `capitalflow-api`
   logs for the `[password-reset] user=<email> link=<url>` line, use it to
   complete a reset.
10. Open a PR — wait for the Vercel preview URL — confirm the API's CORS
    accepts it (no CORS error in the browser console when the preview app
    calls `capitalflow-api`).

## Dashboard links (for future maintenance)

| Service | Dashboard |
|---|---|
| Neon (Postgres) | <https://console.neon.tech> |
| Render (api, market-stream, Redis) | <https://dashboard.render.com> |
| Vercel (apps/web) | <https://vercel.com/dashboard> |
| GitHub Actions (CI, keep-alive) | `https://github.com/<org>/capitalflow/actions` |
| Finnhub (market data API key) | <https://finnhub.io/dashboard> |

## Notes / known limitations

- No custom domain — free subdomains only (out of scope, spec 006 §6).
- No real email sending — forgot-password relies on reading the reset link
  out of Render's logs (spec 006 AC27–AC29); this is documented in the root
  README for reviewers.
- Render free-tier services spin down after 15 minutes of inactivity; the
  keep-alive workflow (`.github/workflows/keepalive.yml`) pings both
  services every 10 minutes to reduce (not eliminate) cold starts.
- Preview deployments are not available for Render services on the free
  plan — only `apps/web` gets per-PR preview URLs via Vercel.
