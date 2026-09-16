import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { MarketIoAdapter } from './market/market-io.adapter';

/**
 * Spec 006 edge case ("JWT key mismatch across services"): logs a short,
 * non-secret fingerprint of the configured RS256 public key at boot so a
 * human can diff this log line against apps/api's own key fingerprint
 * across two independent Render deploys and catch a mismatch — Socket.io
 * auth otherwise fails silently (tokens just never verify) with no signal
 * pointing at "the keys don't match" specifically.
 *
 * Log line only — deliberately NOT part of the `/health` response contract
 * (see health.controller.ts) and not gated by anything; it always logs
 * once at startup.
 */
function logJwtPublicKeyFingerprint(publicKey: string): void {
  const fingerprint = createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, 12);
  Logger.log(`JWT public key fingerprint: ${fingerprint}`, 'Bootstrap');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const origin = config.get('WEB_APP_ORIGIN');

  app.enableCors({
    origin,
    credentials: true,
  });

  // Spec 006 AC10: Socket.io must accept connections from the same origin
  // allowlist as apps/api (localhost:3000, WEB_APP_ORIGIN,
  // WEB_PREVIEW_ORIGIN_REGEX). Must be wired before `app.listen()` so the
  // adapter is in place before the HTTP server (and therefore Socket.io's
  // `engine.io` upgrade handling) starts accepting connections.
  app.useWebSocketAdapter(new MarketIoAdapter(app));

  logJwtPublicKeyFingerprint(config.get('JWT_ACCESS_PUBLIC_KEY'));

  const port = config.get('PORT');
  await app.listen(port);
}

void bootstrap();
