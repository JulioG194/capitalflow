/**
 * Nest webpack config for apps/api.
 *
 * Source imports the Prisma client with a NodeNext-style `.js` specifier
 * (`../../generated/prisma/client.js`) that should resolve to the sibling
 * `.ts` file Prisma emits. Plain webpack only looks for a real `.js` file,
 * which exists locally only if someone accidentally compiled `generated/` —
 * on a fresh Render build there is only `client.ts`, so the default Nest
 * webpack build fails with Module not found.
 *
 * `extensionAlias` mirrors TypeScript's NodeNext resolution rule.
 */
module.exports = function (options) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      extensionAlias: {
        ...(options.resolve && options.resolve.extensionAlias),
        '.js': ['.ts', '.js'],
        '.mjs': ['.mts', '.mjs'],
      },
    },
  };
};
