import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import type { EnvConfig } from './env.schema';

/**
 * `jsonwebtoken`'s `SignOptions.expiresIn` (surfaced through
 * `@nestjs/jwt`) is typed against the `ms` package's template-literal
 * `StringValue` type (e.g. `"15m"`), which only accepts a fixed set of
 * unit suffixes — not a plain runtime-validated `string`. Neither `ms` nor
 * `jsonwebtoken` is a direct dependency of this package (only transitive,
 * via `@nestjs/jwt`), so their exact types aren't importable here under
 * pnpm's strict `node_modules`. Bridging through `unknown` (rather than
 * `any`) is the narrowest way to assign a format that's actually validated
 * — as a non-empty string — by `env.schema.ts` at startup.
 */
type JwtExpiry = NonNullable<JwtSignOptions['expiresIn']>;

/**
 * RS256 access-token signing/verification config for `JwtModule`. The
 * private key signs, the public key verifies (spec 002 section 7) — a
 * future service could hold only `JWT_ACCESS_PUBLIC_KEY` and verify tokens
 * without ever being able to mint them.
 */
export function jwtModuleFactory(
  config: ConfigService<EnvConfig, true>,
): JwtModuleOptions {
  return {
    privateKey: config.get('JWT_ACCESS_PRIVATE_KEY', { infer: true }),
    publicKey: config.get('JWT_ACCESS_PUBLIC_KEY', { infer: true }),
    signOptions: {
      algorithm: 'RS256',
      // See the `JwtExpiry` comment above for why this needs a cast.
      expiresIn: config.get('JWT_ACCESS_TTL', {
        infer: true,
      }) as unknown as JwtExpiry,
    },
    verifyOptions: {
      algorithms: ['RS256'],
    },
  };
}
