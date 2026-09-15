import fs from "node:fs";
import { API_E2E_LOG_FILE } from "./constants";

// Matches ANSI SGR escape sequences so Nest's colored console output can be
// stripped before parsing.
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * `ConsoleEmailAdapter.sendPasswordResetEmail` (spec 002 AC34) logs a line
 * shaped like:
 *   [password reset email] to=<email> subject="..." link=<url>
 * via Nest's default (color-coded) `Logger`, piped by `global-setup.ts`
 * into `API_E2E_LOG_FILE`. This polls that file until a line for the given
 * email shows up and returns the raw `token` query param embedded in its
 * `link=` value — the only way to observe the raw reset token in this
 * suite, since only its SHA-256 hash is ever persisted (spec 002 section 4).
 */
export async function waitForResetToken(
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const linePattern = new RegExp(
    `to=${escapeRegExp(email)}\\s+subject="[^"]*"\\s+link=(\\S+)`,
    "g",
  );

  while (Date.now() < deadline) {
    const contents = fs.existsSync(API_E2E_LOG_FILE)
      ? fs.readFileSync(API_E2E_LOG_FILE, "utf-8")
      : "";
    const plain = contents.replace(ANSI_PATTERN, "");
    const matches = [...plain.matchAll(linePattern)];

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const link = lastMatch[1];
      const token = new URL(link).searchParams.get("token");
      if (token) {
        return token;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Timed out waiting for a password reset link for "${email}" in ${API_E2E_LOG_FILE}`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
