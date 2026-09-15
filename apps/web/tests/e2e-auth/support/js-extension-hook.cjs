// Plain CommonJS (not `.ts`) because it must patch Node's own module loader
// before anything else runs, independent of TypeScript tooling.
//
// `apps/api`'s source imports its generated Prisma client with an explicit
// `.js` extension (`from '../../generated/prisma/client.js'`), per the
// TypeScript `moduleResolution: "nodenext"` convention where a `.js`
// specifier is expected to resolve to a sibling `.ts` file at compile time.
// `tsc`/`ts-jest` both understand this; a plain `ts-node/register` (CJS
// mode) does not, and fails with `MODULE_NOT_FOUND` because only
// `client.ts` actually exists on disk.
//
// `apps/api`'s own Jest e2e config already works around exactly this with
// `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` — this hook
// reproduces the same rule as a `Module._resolveFilename` patch so the
// same source can boot as a real, live HTTP server for Playwright (which
// needs a real process, not an in-process Nest app like Jest's supertest
// setup). Load this via `node -r` alongside `ts-node/register`.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- this is a plain Node CJS preload script (loaded via `node -r`), not application source; it must patch `Module._resolveFilename` before ts-node/ESM tooling ever runs.
const Module = require("module");

const original = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(request, ...rest) {
  if (/^\.{1,2}\/.*\.js$/.test(request)) {
    try {
      return original.call(this, request.slice(0, -3), ...rest);
    } catch {
      // Fall through and let the original (unmodified) request resolve
      // normally below — e.g. a real sibling `.js` file does exist.
    }
  }
  return original.call(this, request, ...rest);
};
