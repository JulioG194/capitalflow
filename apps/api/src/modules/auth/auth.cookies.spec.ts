import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';
import {
  buildClearRefreshCookieOptions,
  buildClearSessionHintCookieOptions,
  buildRefreshCookieOptions,
  buildSessionHintCookieOptions,
} from './auth.cookies';

function fakeConfig(
  nodeEnv: EnvConfig['NODE_ENV'],
): ConfigService<EnvConfig, true> {
  return {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return nodeEnv;
      if (key === 'JWT_REFRESH_TTL_DAYS') return 7;
      return undefined;
    }),
  } as unknown as ConfigService<EnvConfig, true>;
}

describe('auth cookie builders (spec 006 AC9)', () => {
  describe('buildRefreshCookieOptions', () => {
    it('uses SameSite=None + Secure in production (cross-site: Vercel <-> Render)', () => {
      const options = buildRefreshCookieOptions(fakeConfig('production'));

      expect(options.sameSite).toBe('none');
      expect(options.secure).toBe(true);
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/auth');
    });

    it('uses SameSite=Lax without Secure in development (plain HTTP)', () => {
      const options = buildRefreshCookieOptions(fakeConfig('development'));

      expect(options.sameSite).toBe('lax');
      expect(options.secure).toBe(false);
    });

    it('uses SameSite=Lax without Secure in test', () => {
      const options = buildRefreshCookieOptions(fakeConfig('test'));

      expect(options.sameSite).toBe('lax');
      expect(options.secure).toBe(false);
    });
  });

  describe('buildClearRefreshCookieOptions', () => {
    it('matches the SameSite/Secure attributes used to set the cookie, in production', () => {
      const options = buildClearRefreshCookieOptions(fakeConfig('production'));

      expect(options.sameSite).toBe('none');
      expect(options.secure).toBe(true);
      expect(options.path).toBe('/auth');
    });

    it('matches the SameSite/Secure attributes used to set the cookie, in development', () => {
      const options = buildClearRefreshCookieOptions(fakeConfig('development'));

      expect(options.sameSite).toBe('lax');
      expect(options.secure).toBe(false);
    });
  });

  describe('buildSessionHintCookieOptions', () => {
    it('follows the same SameSite/Secure split as the refresh cookie, but keeps Path=/', () => {
      const prod = buildSessionHintCookieOptions(fakeConfig('production'));
      expect(prod.sameSite).toBe('none');
      expect(prod.secure).toBe(true);
      expect(prod.path).toBe('/');

      const dev = buildSessionHintCookieOptions(fakeConfig('development'));
      expect(dev.sameSite).toBe('lax');
      expect(dev.secure).toBe(false);
      expect(dev.path).toBe('/');
    });
  });

  describe('buildClearSessionHintCookieOptions', () => {
    it('follows the same SameSite/Secure split as the refresh cookie, but keeps Path=/', () => {
      const prod = buildClearSessionHintCookieOptions(fakeConfig('production'));
      expect(prod.sameSite).toBe('none');
      expect(prod.secure).toBe(true);
      expect(prod.path).toBe('/');

      const dev = buildClearSessionHintCookieOptions(fakeConfig('development'));
      expect(dev.sameSite).toBe('lax');
      expect(dev.secure).toBe(false);
      expect(dev.path).toBe('/');
    });
  });
});
