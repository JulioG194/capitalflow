# Infra

Docker Compose (local dev) and cloud deployment docs for CapitalFlow.

- `docker-compose.dev.yml` — local Postgres + Redis for `pnpm dev`.
- [`DEPLOY.md`](./DEPLOY.md) — one-time manual setup for Neon + Render +
  Vercel (spec 006). `render.yaml` (repo root) and `.github/workflows/`
  handle deploys automatically after that setup is done.
