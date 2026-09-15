import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Global, Injectable, Module } from '@nestjs/common';
import { validate, type EnvConfig } from './env.schema';

/**
 * Loads `.env` from `process.cwd()` (apps/market-stream when started via
 * `pnpm --filter`). Kept local rather than `@nestjs/config` so this service
 * does not depend on that package's install layout.
 */
function loadDotenvFile(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return {};
  }
  const parsed: Record<string, string> = {};
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

@Injectable()
export class AppConfigService {
  private readonly env: EnvConfig;

  constructor() {
    this.env = validate({ ...process.env, ...loadDotenvFile() });
  }

  get<K extends keyof EnvConfig>(
    key: K,
    _options?: { infer: true },
  ): EnvConfig[K] {
    return this.env[key];
  }
}

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
