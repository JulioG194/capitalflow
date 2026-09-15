import { z } from 'zod';

/**
 * PEM keys are stored in `.env` as a single line with literal `\n` sequences
 * (since real newlines are not valid inside a dotenv value). This schema
 * un-escapes them back into a real multi-line PEM string.
 */
const pemKeySchema = z
  .string()
  .min(1, 'PEM key must not be empty')
  .transform((value) => value.replace(/\\n/g, '\n'));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis instance apps/market-stream caches prices in (spec 003 AC8).
  // apps/api only ever reads from it (spec 004 section 4) — it never talks
  // to Finnhub directly, per CLAUDE.md's external-dependency constraint.
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // RS256 key pair used to sign (private) and verify (public) access tokens.
  JWT_ACCESS_PRIVATE_KEY: pemKeySchema,
  JWT_ACCESS_PUBLIC_KEY: pemKeySchema,
  // Access token lifetime, in `jsonwebtoken`/`ms` format (e.g. "15m").
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  // Refresh token lifetime, in whole days.
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Password reset token lifetime, in whole minutes.
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive(),

  // Rate limit applied to POST /auth/login.
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  // Origin of `apps/web`. Used both for `app.enableCors()` (credentialed
  // cross-origin cookie requests require an explicit, non-wildcard origin)
  // and for building the link embedded in password-reset emails.
  WEB_APP_ORIGIN: z.string().min(1).default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validated at bootstrap via `ConfigModule.forRoot({ validate })`. Throws
 * (and therefore fails the app's startup) if any required env var is
 * missing or malformed, instead of surfacing a confusing runtime error
 * later.
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
