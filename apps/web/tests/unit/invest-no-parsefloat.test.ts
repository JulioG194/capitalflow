import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * AC32: every monetary value rendered under `/app/invest` must go through
 * `formatMoney` exclusively — never `parseFloat()`/`Number()` on a monetary
 * string field (mirrors spec 004 AC30's `portfolio-no-parsefloat.test.ts`,
 * same static file-content check, not an AST walk).
 *
 * `RendimientoCalculator.tsx` is deliberately excluded from this scan: its
 * `amount`/`months` inputs are never DB/API monetary strings, and spec 005
 * section 4 explicitly exempts this illustrative-only, never-persisted
 * computation from CLAUDE.md's "never JS number for money" rule (the same
 * exemption `formatMoney`'s own implementation gets). Applying a blanket
 * "no `Number(`" scan to that file would flag its legitimate, in-scope
 * `Number(amountInput)`/`Number(monthsInput)` input-parsing — which never
 * touches a real monetary field — as if it were the same violation this
 * test exists to catch elsewhere on the page (`InvestForm`,
 * `ConfirmInvestModal`, the page shell, the disclaimer). This is a
 * deliberate, narrower scope than spec 004's equivalent test, flagged here
 * rather than silently applied.
 */

const TARGET_DIRS = [
  path.join(__dirname, "..", "..", "src", "components", "app", "invest"),
  path.join(__dirname, "..", "..", "src", "app", "(app)", "app", "invest"),
];

const EXCLUDED_FILENAMES = new Set(["RendimientoCalculator.tsx"]);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !EXCLUDED_FILENAMES.has(entry)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("AC32: no parseFloat()/Number() conversion under /app/invest (excluding the illustrative calculator)", () => {
  const files = TARGET_DIRS.flatMap(collectSourceFiles);

  it("found at least one source file to check (sanity check on the test itself)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
    "%s never calls parseFloat( or Number(",
    (_label, file) => {
      const source = readFileSync(file, "utf-8");
      expect(source).not.toContain("parseFloat(");
      expect(source).not.toContain("Number(");
    },
  );
});
