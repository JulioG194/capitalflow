---
description: Implement a spec using the right subagent, plan-first
---

Implement `$ARGUMENTS` (path to a spec file).

Steps:

1. Read `CLAUDE.md`.
2. Read the spec file `$ARGUMENTS`.
3. Determine which subagent to use based on the files the spec touches:
   - `apps/web/app/(marketing)/*` → `frontend-landing`
   - `apps/web/app/(app)/*` or `apps/web/app/(auth)/*` → `frontend-app`
   - `apps/api/*` or `apps/market-stream/*` → `backend-nestjs`
   - Full-stack specs → coordinate: backend first, then frontend
4. **Produce the plan first, DO NOT WRITE CODE**. The plan must include:
   - Files to create or modify (full paths)
   - Order of operations
   - AC → file mapping
   - Migrations (if any)
   - New environment variables (if any)
   - Validation approach for each AC
5. STOP and wait for my approval.
6. Once I approve, execute one acceptance-criterion block at a time. Stop after each block for review.
7. Before declaring an AC complete, run typecheck, lint, and tests. If anything fails, fix before moving on.
8. Commit per AC block with message format: `feat(scope): ACx-ACy description (spec NNN)`.
