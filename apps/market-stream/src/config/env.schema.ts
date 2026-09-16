import { z } from 'zod';

/**
 * PEM keys are stored in `.env` as a single line with literal `\n` sequences
 * (same convention as `apps/api`). This schema un-escapes them back into a
 * real multi-line PEM string.
 */
const pemKeySchema = z
  .string()
  .min(1, 'PEM key must not be empty')
  .transform((value) => value.replace(/\\n/g, '\n'));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Pinned to 3002 so it does not collide with apps/web (3000) or apps/api
  // (3001). Matches `NEXT_PUBLIC_MARKET_STREAM_URL` in the repo .env.example.
  PORT: z.coerce.number().int().positive().default(3002),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Verify-only: market-stream must never hold the private signing key
  // (spec 003 section 7).
  JWT_ACCESS_PUBLIC_KEY: pemKeySchema,

  FINNHUB_API_KEY: z.string().min(1, 'FINNHUB_API_KEY is required'),
  FINNHUB_WS_URL: z.string().url().default('wss://ws.finnhub.io'),
  // REST base for AC10 cache-miss bootstrap (quote endpoint lives under /quote).
  FINNHUB_REST_URL: z.string().url().default('https://finnhub.io/api/v1'),

  // Spec 003 section 7: reconnect backoff is config, not magic numbers.
  FINNHUB_RECONNECT_BASE_MS: z.coerce.number().int().positive().default(1000),
  FINNHUB_RECONNECT_MULTIPLIER: z.coerce.number().positive().default(2),
  FINNHUB_RECONNECT_MAX_MS: z.coerce.number().int().positive().default(30_000),

  // Spec 003 section 7: outbound queue depth for AC16.
  FANOUT_QUEUE_MAX_DEPTH: z.coerce.number().int().positive().default(500),
  QUOTE_THROTTLE_MS: z.coerce.number().int().positive().default(1000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  REDIS_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  WEB_APP_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  // Optional regex matching Vercel preview-deploy origins (spec 006 AC10),
  // same value as apps/api's `WEB_PREVIEW_ORIGIN_REGEX`. Deliberately has NO
  // default: if unset, `isOriginAllowed` (see `@capitalflow/shared-types`)
  // allows zero preview origins — fail closed, not a permissive fallback.
  WEB_PREVIEW_ORIGIN_REGEX: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (value === undefined) {
          return true;
        }
        try {
          new RegExp(value);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: 'WEB_PREVIEW_ORIGIN_REGEX must be a valid regular expression',
      },
    ),
});

export type EnvConfig = z.infer<typeof envSchema>;

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
