import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { SocketAuthService } from './socket-auth.service';
import { AppConfigService } from '../config/app-config.service';
import type { EnvConfig } from '../config/env.schema';

function keyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function makeService(publicKey: string): SocketAuthService {
  return new SocketAuthService(
    new JwtService(),
    {
      get: (key: keyof EnvConfig) => {
        if (key === 'JWT_ACCESS_PUBLIC_KEY') return publicKey;
        throw new Error(`unexpected config key ${String(key)}`);
      },
    } as AppConfigService,
  );
}

function signToken(
  privateKey: string,
  payload: Record<string, unknown>,
  expiresIn: '15m' | '-1s',
): string {
  return new JwtService().sign(payload, {
    privateKey,
    algorithm: 'RS256',
    expiresIn,
  });
}

describe('SocketAuthService (AC18–AC20)', () => {
  const { publicKey, privateKey } = keyPair();
  const other = keyPair();
  const service = makeService(publicKey);

  it('AC18: accepts a valid unexpired RS256 access token', () => {
    const token = signToken(privateKey, { sub: 'user-1', email: 'a@b.c' }, '15m');
    expect(service.verifyHandshakeToken(token)).toEqual({
      sub: 'user-1',
      email: 'a@b.c',
    });
  });

  it('AC19: rejects a missing token', () => {
    expect(service.verifyHandshakeToken(undefined)).toBeNull();
    expect(service.verifyHandshakeToken('')).toBeNull();
  });

  it('AC19: rejects a malformed token identically to a missing one', () => {
    expect(service.verifyHandshakeToken('not-a-jwt')).toBeNull();
  });

  it('AC19: rejects an expired token identically to a missing one', () => {
    const token = signToken(privateKey, { sub: 'user-1', email: 'a@b.c' }, '-1s');
    expect(service.verifyHandshakeToken(token)).toBeNull();
  });

  it('AC20: rejects a tampered/wrong-key token identically to AC19', () => {
    const token = signToken(
      other.privateKey,
      { sub: 'user-1', email: 'a@b.c' },
      '15m',
    );
    expect(service.verifyHandshakeToken(token)).toBeNull();
  });
});
