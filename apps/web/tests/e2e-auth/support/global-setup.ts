import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  API_E2E_BASE_URL,
  API_E2E_LOG_FILE,
  API_E2E_PORT,
  E2E_EMAIL_DOMAIN,
  WEB_E2E_BASE_URL,
} from "./constants";

const REPO_ROOT = path.resolve(__dirname, "../../../../../");
const API_DIR = path.join(REPO_ROOT, "apps/api");
const JS_EXTENSION_HOOK = path.join(__dirname, "js-extension-hook.cjs");

/**
 * Spec 002 section 8's Playwright plan is the first e2e suite in this repo
 * that needs a *live* `apps/api` process: the forgot-password flow must
 * read the `ConsoleEmailAdapter`'s logged reset link off real process
 * stdout (AC34), which is something Playwright's own `webServer` option
 * cannot expose to test code, and something the existing Jest e2e suite
 * never needed either (it drives an in-process Nest app via `supertest`,
 * never an actual listening HTTP server).
 *
 * This boots `apps/api`'s real `src/main.ts` directly via `ts-node`
 * (bypassing `nest build`, whose `dist/apps/api/src/main.js` output does
 * not actually run under plain `node` in this repo today — the generated
 * Prisma client is imported with a `.js` specifier that only resolves via
 * a bundler/`tsc`'s own module resolution, not a bare `node` process; see
 * `js-extension-hook.cjs` for the same workaround `apps/api`'s own Jest e2e
 * config already applies via `moduleNameMapper`), against the same
 * Postgres database the Jest e2e suite uses (`apps/api/.env`'s
 * `DATABASE_URL`, `infra/docker-compose.dev.yml`). Every account this
 * suite creates lives under `E2E_EMAIL_DOMAIN`, so the returned teardown
 * can delete exactly those rows without touching anything else.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  fs.writeFileSync(API_E2E_LOG_FILE, "");
  const logStream = fs.createWriteStream(API_E2E_LOG_FILE, { flags: "a" });

  const child = spawn(
    "node",
    [
      "-r",
      "ts-node/register",
      "-r",
      "tsconfig-paths/register",
      "-r",
      JS_EXTENSION_HOOK,
      "src/main.ts",
    ],
    {
      cwd: API_DIR,
      env: {
        ...process.env,
        PORT: String(API_E2E_PORT),
        // `app.enableCors()` and the password-reset link builder both key
        // off this — it must match `WEB_E2E_BASE_URL` exactly
        // (scheme+host+port), or the browser's credentialed fetches from
        // the Playwright-managed web server would be CORS-rejected (the
        // refresh cookie itself is fine either way — it's host-, not
        // origin-, scoped across ports; see the comment on
        // `WEB_E2E_BASE_URL`).
        WEB_APP_ORIGIN: WEB_E2E_BASE_URL,
      },
    },
  );
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  try {
    await waitForServerReady(child);
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }

  return async function globalTeardown() {
    await stopProcess(child);
    logStream.end();
    await deleteE2eTestUsers();
  };
}

function waitForServerReady(
  child: ReturnType<typeof spawn>,
): Promise<void> {
  const deadline = Date.now() + 60_000;

  return new Promise((resolve, reject) => {
    let settled = false;

    const onEarlyExit = (code: number | null) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `apps/api (e2e) exited early (code ${code}) — see ${API_E2E_LOG_FILE}`,
        ),
      );
    };
    child.once("exit", onEarlyExit);

    void (async () => {
      while (!settled && Date.now() < deadline) {
        try {
          const response = await fetch(`${API_E2E_BASE_URL}/`);
          if (response.ok) {
            settled = true;
            child.off("exit", onEarlyExit);
            resolve();
            return;
          }
        } catch {
          // Not listening yet — keep polling.
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!settled) {
        settled = true;
        reject(
          new Error(
            `apps/api (e2e) did not become ready within 60s — see ${API_E2E_LOG_FILE}`,
          ),
        );
      }
    })();
  });
}

function stopProcess(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/**
 * Best-effort cleanup via the `psql` CLI against the same dev database the
 * Jest e2e suite uses (`apps/api/.env`'s `DATABASE_URL`) — scoped to
 * exactly the `@e2e.capitalflow.test` addresses this suite creates (see
 * `e2eEmail()`), so it can never touch real or Jest-created rows.
 * `RefreshToken`/`PasswordResetToken` cascade-delete with their `User`
 * (see `apps/api/prisma/schema.prisma`), so this single statement is
 * sufficient. Not fatal if `psql` isn't installed or the delete fails —
 * this is a local dev database, not production, and every run uses fresh,
 * timestamped emails, so stale rows from a skipped cleanup never collide
 * with a future run.
 */
async function deleteE2eTestUsers(): Promise<void> {
  try {
    const databaseUrl = readDatabaseUrlFromApiEnv();
    if (!databaseUrl) return;

    const result = spawnSync(
      "psql",
      [
        databaseUrl,
        "-c",
        `DELETE FROM "User" WHERE email LIKE '%@${E2E_EMAIL_DOMAIN}';`,
      ],
      { encoding: "utf-8" },
    );
    if (result.status !== 0) {
      console.warn(
        `[auth e2e] psql cleanup of @${E2E_EMAIL_DOMAIN} rows failed (non-fatal):`,
        result.stderr || result.error,
      );
    }
  } catch (error) {
    // Best-effort only — see comment above.
    console.warn(`[auth e2e] psql cleanup threw (non-fatal):`, error);
  }
}

/**
 * `psql` (unlike Prisma's own driver) doesn't understand Prisma-specific
 * connection-string query params such as `?schema=public` — strip any
 * query string before handing the URL to `psql`.
 */
function readDatabaseUrlFromApiEnv(): string | null {
  const envPath = path.join(API_DIR, ".env");
  if (!fs.existsSync(envPath)) return null;

  const contents = fs.readFileSync(envPath, "utf-8");
  const match = /^DATABASE_URL="?([^"\n]+)"?$/m.exec(contents);
  if (!match) return null;

  const [urlWithoutQuery] = match[1].split("?");
  return urlWithoutQuery;
}
