import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * AC30: every monetary/decimal-string field under `/app/portfolio` must be
 * rendered exclusively through `formatMoney` (or, for non-monetary signed
 * strings like `roiPercent`, inspected only via string-level checks) — never
 * `parseFloat()`/`Number()`. This is a static, file-content check (not an
 * AST walk) over every source file in the two directories the spec's
 * frontend work touched.
 */

const TARGET_DIRS = [
  path.join(__dirname, "..", "..", "src", "components", "app", "portfolio"),
  path.join(__dirname, "..", "..", "src", "lib", "portfolio"),
];

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("AC30: no parseFloat()/Number() conversion under /app/portfolio", () => {
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
