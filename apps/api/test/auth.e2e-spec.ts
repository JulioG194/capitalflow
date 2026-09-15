import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { hashToken } from './../src/modules/auth/auth.crypto';
import { EmailService } from './../src/modules/auth/email/email.service';

interface UserResponseBody {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface ErrorResponseBody {
  statusCode: number;
  code?: string;
  message: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registeredEmails: string[] = [];
  const sendPasswordResetEmail = jest
    .fn<Promise<void>, [{ to: string; resetLink: string }]>()
    .mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ sendPasswordResetEmail })
      // This shared app instance is reused by every describe block below,
      // many of which log in far more than the real AC30 threshold (5/min)
      // as part of their own setup — real throttling behavior is instead
      // exercised in its own isolated app instance, see the dedicated
      // "POST /auth/login rate limiting" describe block.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    sendPasswordResetEmail.mockClear();
  });

  afterAll(async () => {
    if (registeredEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: registeredEmails } },
      });
    }
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('AC1: creates a user with valid input and returns 201 with no hash/tokens', async () => {
      const email = `ac1-${Date.now()}@example.com`;
      registeredEmails.push(email);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'correcthorse1', name: 'Ada Lovelace' })
        .expect(201);

      const body = response.body as UserResponseBody;
      expect(body).toMatchObject({
        email,
        name: 'Ada Lovelace',
      });
      expect(typeof body.id).toBe('string');
      expect(typeof body.createdAt).toBe('string');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
    });

    it('AC2: rejects a duplicate email (case-insensitive) with 409 EMAIL_ALREADY_EXISTS', async () => {
      const email = `ac2-${Date.now()}@example.com`;
      registeredEmails.push(email);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'correcthorse1', name: 'First User' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: email.toUpperCase(),
          password: 'correcthorse1',
          name: 'Second User',
        })
        .expect(409);

      expect((response.body as ErrorResponseBody).code).toBe(
        'EMAIL_ALREADY_EXISTS',
      );

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(1);
    });

    it('AC3: rejects a password shorter than 10 characters with 400', async () => {
      const email = `ac3-short-${Date.now()}@example.com`;

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'short1a', name: 'Short Password' })
        .expect(400);

      expect((response.body as ErrorResponseBody).statusCode).toBe(400);

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(0);
    });

    it('AC3: rejects a password missing a letter with 400', async () => {
      const email = `ac3-noletter-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: '1234567890', name: 'No Letter' })
        .expect(400);

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(0);
    });

    it('AC3: rejects a password missing a number with 400', async () => {
      const email = `ac3-nonumber-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'nonumbershere', name: 'No Number' })
        .expect(400);

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(0);
    });

    it('AC4: normalizes a mixed-case email to lowercase when stored', async () => {
      const rawEmail = `AC4-Mixed-${Date.now()}@Example.com`;
      const lowercased = rawEmail.toLowerCase();
      registeredEmails.push(lowercased);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: rawEmail,
          password: 'correcthorse1',
          name: 'Mixed Case',
        })
        .expect(201);

      expect((response.body as UserResponseBody).email).toBe(lowercased);

      const stored = await prisma.user.findUnique({
        where: { email: lowercased },
      });
      expect(stored).not.toBeNull();
    });

    it('AC5: rejects extra/unexpected fields and persists nothing', async () => {
      const email = `ac5-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'correcthorse1',
          name: 'Extra Fields',
          role: 'admin',
        })
        .expect(400);

      const count = await prisma.user.count({ where: { email } });
      expect(count).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    const password = 'correcthorse1';

    async function registerUser(email: string): Promise<void> {
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Login Fixture' })
        .expect(201);
    }

    it('AC6/AC10/AC11: succeeds with correct credentials, returns an access token, sets an HttpOnly refresh cookie, and never returns the raw refresh token in the JSON body', async () => {
      const email = `login-ac6-${Date.now()}@example.com`;
      await registerUser(email);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      const body = response.body as {
        accessToken: string;
        user: { id: string; email: string; name: string };
      };
      expect(typeof body.accessToken).toBe('string');
      expect(body.user).toMatchObject({ email });
      expect(JSON.stringify(response.body)).not.toMatch(/refreshToken/i);

      const [decodedHeader, decodedPayload] = body.accessToken
        .split('.')
        .slice(0, 2)
        .map(
          (segment) =>
            JSON.parse(
              Buffer.from(segment, 'base64url').toString('utf8'),
            ) as Record<string, unknown>,
        );
      expect(decodedHeader.alg).toBe('RS256');
      expect(decodedPayload.sub).toBe(body.user.id);
      expect(decodedPayload.email).toBe(email);
      expect(typeof decodedPayload.iat).toBe('number');
      expect(typeof decodedPayload.exp).toBe('number');

      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      const refreshCookie = (setCookieHeader as unknown as string[]).find((c) =>
        c.startsWith('cf_refresh_token='),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/HttpOnly/i);
      expect(refreshCookie).toMatch(/SameSite=Lax/i);
      expect(refreshCookie).toMatch(/Path=\/auth/i);
      // Secure is only set in production (NODE_ENV=test here).
      expect(refreshCookie).not.toMatch(/Secure/i);

      // Session-hint cookie: set alongside the refresh cookie, but scoped
      // to Path=/ (unlike the refresh cookie's Path=/auth) so apps/web
      // middleware can see it on /app/* requests. Its value is a fixed,
      // meaningless literal, never the real (sensitive) refresh token.
      const hintCookie = (setCookieHeader as unknown as string[]).find((c) =>
        c.startsWith('cf_has_session='),
      );
      expect(hintCookie).toBeDefined();
      expect(hintCookie).toMatch(/^cf_has_session=1;/i);
      expect(hintCookie).toMatch(/HttpOnly/i);
      expect(hintCookie).toMatch(/SameSite=Lax/i);
      // Exactly root path (not a prefix match, which would also accept
      // the refresh cookie's Path=/auth).
      expect(hintCookie).toMatch(/;\s*Path=\/(;|$)/i);
      expect(hintCookie).not.toMatch(/Path=\/auth/i);
      expect(hintCookie).not.toMatch(/Secure/i);
    });

    it('AC7: rejects a correct email with the wrong password with a generic 401', async () => {
      const email = `login-ac7-${Date.now()}@example.com`;
      await registerUser(email);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password-1' })
        .expect(401);

      expect((response.body as ErrorResponseBody).code).toBe(
        'INVALID_CREDENTIALS',
      );
    });

    it('AC8: rejects a non-existent email with the identical response as AC7', async () => {
      const wrongPasswordResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: `nobody-${Date.now()}@example.com`,
          password: 'wrong-password-1',
        })
        .expect(401);

      const email = `login-ac8-${Date.now()}@example.com`;
      await registerUser(email);
      const badPasswordResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password-1' })
        .expect(401);

      expect(wrongPasswordResponse.body).toEqual(badPasswordResponse.body);
    });
  });

  describe('POST /auth/refresh', () => {
    const password = 'correcthorse1';

    async function registerAndLogin(email: string): Promise<{
      accessToken: string;
      refreshCookie: string;
    }> {
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Refresh Fixture' })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      const setCookie = loginResponse.headers[
        'set-cookie'
      ] as unknown as string[];
      const refreshCookie = setCookie
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];

      return {
        accessToken: (loginResponse.body as { accessToken: string })
          .accessToken,
        refreshCookie,
      };
    }

    it('AC12: rotates a valid refresh token — 200, new access token, new rotated cookie', async () => {
      const email = `refresh-ac12-${Date.now()}@example.com`;
      const { refreshCookie } = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      const body = response.body as { accessToken: string };
      // Note: a fresh access token issued within the same second as the
      // login one can be byte-identical (JWT signing is deterministic for
      // an identical payload+iat) — that's expected, not a bug, so this
      // only asserts shape rather than inequality with the original token.
      expect(body.accessToken.split('.')).toHaveLength(3);

      const setCookie = response.headers['set-cookie'] as unknown as string[];
      const newRefreshCookie = setCookie.find((c) =>
        c.startsWith('cf_refresh_token='),
      );
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toBe(refreshCookie);

      // Session-hint cookie is re-set alongside the rotated refresh cookie.
      const hintCookie = setCookie.find((c) => c.startsWith('cf_has_session='));
      expect(hintCookie).toBeDefined();
      expect(hintCookie).toMatch(/^cf_has_session=1;/i);
    });

    it('AC13: an expired refresh token is rejected with 401 and the cookie is cleared', async () => {
      const email = `refresh-ac13-${Date.now()}@example.com`;
      const { refreshCookie } = await registerAndLogin(email);

      const rawToken = refreshCookie.split('=')[1];
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(rawToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);

      expect((response.body as ErrorResponseBody).code).toBe(
        'INVALID_REFRESH_TOKEN',
      );
      const setCookie = response.headers['set-cookie'] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('cf_refresh_token=;'))).toBe(
        true,
      );
      // The session-hint cookie is cleared alongside the refresh cookie on
      // this failure path too — the two must never drift out of sync.
      expect(setCookie.some((c) => c.startsWith('cf_has_session=;'))).toBe(
        true,
      );
    });

    it('AC14/AC15: replaying an already-rotated token revokes every session for that user', async () => {
      const email = `refresh-ac14-${Date.now()}@example.com`;
      const { refreshCookie: firstCookie } = await registerAndLogin(email);

      const rotateResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(200);
      const secondCookie = (
        rotateResponse.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];

      // Replaying the now-rotated first cookie is a proven reuse (AC14).
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(401);

      // AC15: the full revocation triggered above must also invalidate the
      // session that "legitimately" won the rotation — no refresh token
      // this user holds can produce a new session without a fresh login.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', secondCookie)
        .expect(401);
    });

    it('AC16: two simultaneous refreshes with the same token — at most one succeeds, and the win is later invalidated by the reuse-driven full revocation', async () => {
      const email = `refresh-ac16-${Date.now()}@example.com`;
      const { refreshCookie } = await registerAndLogin(email);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', refreshCookie),
        request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', refreshCookie),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 401]);

      const winner = first.status === 200 ? first : second;
      const winnerCookie = (winner.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];

      // The race loser is treated as a reuse: full revocation nukes the
      // winner's brand-new token too.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', winnerCookie)
        .expect(401);
    });

    it('AC17: no refresh cookie present responds 401 without any rotation side effects', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);

      expect((response.body as ErrorResponseBody).code).toBe(
        'INVALID_REFRESH_TOKEN',
      );
    });
  });

  describe('POST /auth/logout', () => {
    const password = 'correcthorse1';

    it('AC18: revokes a valid refresh session, clears the cookie, and responds 200', async () => {
      const email = `logout-ac18-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Logout Fixture' })
        .expect(201);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const refreshCookie = (
        loginResponse.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];

      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(logoutResponse.body).toEqual({});
      const setCookie = logoutResponse.headers[
        'set-cookie'
      ] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('cf_refresh_token=;'))).toBe(
        true,
      );
      // Logout clears the session-hint cookie in lockstep with the real
      // refresh cookie.
      expect(setCookie.some((c) => c.startsWith('cf_has_session=;'))).toBe(
        true,
      );

      // The revoked session can no longer be used to refresh.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
    });

    it('AC19: is idempotent — 200 with no cookie at all', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({});
    });

    it('AC19: is idempotent — 200 when the presented cookie is already revoked', async () => {
      const email = `logout-ac19-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Logout Fixture' })
        .expect(201);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const refreshCookie = (
        loginResponse.headers['set-cookie'] as unknown as string[]
      )
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', refreshCookie)
        .expect(200);

      const secondResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(secondResponse.body).toEqual({});
    });
  });

  describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
    const password = 'correcthorse1';
    const GENERIC_MESSAGE =
      'If that email exists, a password reset link has been sent.';

    async function registerAndLogin(email: string): Promise<string> {
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Reset Fixture' })
        .expect(201);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return (loginResponse.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('cf_refresh_token='))!
        .split(';')[0];
    }

    async function requestResetToken(email: string): Promise<string> {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(200);
      const call = sendPasswordResetEmail.mock.calls.find(
        ([params]) => params.to === email,
      );
      expect(call).toBeDefined();
      const resetLink = call![0].resetLink;
      return new URL(resetLink).searchParams.get('token')!;
    }

    it('AC20: generates and emails a reset token for an existing email, with a generic response', async () => {
      const email = `reset-ac20-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Reset Fixture' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect((response.body as { message: string }).message).toBe(
        GENERIC_MESSAGE,
      );
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [params] = sendPasswordResetEmail.mock.calls[0];
      expect(params.to).toBe(email);
      expect(params.resetLink).toContain('/reset-password?token=');
    });

    it('AC21: returns the identical generic message and never emails for a non-existent address', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `nobody-${Date.now()}@example.com` })
        .expect(200);

      expect((response.body as { message: string }).message).toBe(
        GENERIC_MESSAGE,
      );
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('AC22: a valid token resets the password and revokes every existing session for that user', async () => {
      const email = `reset-ac22-${Date.now()}@example.com`;
      const oldRefreshCookie = await registerAndLogin(email);
      const token = await requestResetToken(email);
      const newPassword = 'brandnewpassword1';

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword })
        .expect(200);

      // The pre-reset session is fully revoked (AC22).
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldRefreshCookie)
        .expect(401);

      // Old password no longer works; new one does.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(200);
    });

    it('AC23: rejects an already-used token with a generic 400', async () => {
      const email = `reset-ac23-used-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Reset Fixture' })
        .expect(201);
      const token = await requestResetToken(email);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'brandnewpassword1' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'anothernewpassword1' })
        .expect(400);

      expect((response.body as ErrorResponseBody).code).toBe(
        'INVALID_RESET_TOKEN',
      );
    });

    it('AC23/AC25: rejects an expired token with the identical generic 400', async () => {
      const email = `reset-ac25-expired-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Reset Fixture' })
        .expect(201);
      const token = await requestResetToken(email);
      await prisma.passwordResetToken.updateMany({
        where: { tokenHash: hashToken(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'brandnewpassword1' })
        .expect(400);

      expect((response.body as ErrorResponseBody).code).toBe(
        'INVALID_RESET_TOKEN',
      );
    });

    it('AC24: a complexity failure on newPassword is a 400 and does not consume the token', async () => {
      const email = `reset-ac24-${Date.now()}@example.com`;
      registeredEmails.push(email);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Reset Fixture' })
        .expect(201);
      const token = await requestResetToken(email);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'short1' })
        .expect(400);

      // The token is still usable after the complexity failure.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'brandnewpassword1' })
        .expect(200);
    });
  });

  describe('GET /auth/me + PATCH /auth/me', () => {
    const password = 'correcthorse1';

    async function registerAndGetAccessToken(email: string): Promise<{
      accessToken: string;
      id: string;
    }> {
      registeredEmails.push(email);
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: 'Profile Fixture' })
        .expect(201);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return {
        accessToken: (loginResponse.body as { accessToken: string })
          .accessToken,
        id: (registerResponse.body as UserResponseBody).id,
      };
    }

    it('AC26: returns the authenticated profile for a valid access token', async () => {
      const email = `me-ac26-${Date.now()}@example.com`;
      const { accessToken, id } = await registerAndGetAccessToken(email);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UserResponseBody;
      expect(body).toEqual({
        id,
        email,
        name: 'Profile Fixture',
        createdAt: expect.any(String) as unknown,
      });
    });

    it('AC27: rejects a missing access token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('AC27: rejects a malformed access token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('AC28: updates the name via PATCH and returns the updated profile', async () => {
      const email = `me-ac28-${Date.now()}@example.com`;
      const { accessToken, id } = await registerAndGetAccessToken(email);

      const response = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body).toEqual({
        id,
        email,
        name: 'Updated Name',
        createdAt: expect.any(String) as unknown,
      });

      const getResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect((getResponse.body as UserResponseBody).name).toBe('Updated Name');
    });

    it('AC29: rejects an attempt to set email via PATCH', async () => {
      const email = `me-ac29-email-${Date.now()}@example.com`;
      const { accessToken } = await registerAndGetAccessToken(email);

      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Still Valid', email: 'new@example.com' })
        .expect(400);
    });

    it('AC29: rejects an attempt to set password via PATCH', async () => {
      const email = `me-ac29-password-${Date.now()}@example.com`;
      const { accessToken } = await registerAndGetAccessToken(email);

      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Still Valid', password: 'newpassword1' })
        .expect(400);
    });

    it('Edge Case: rejects an empty PATCH body with 400 rather than a silent no-op 200', async () => {
      const email = `me-empty-body-${Date.now()}@example.com`;
      const { accessToken } = await registerAndGetAccessToken(email);

      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });
});

describe('POST /auth/login rate limiting (AC30/AC31)', () => {
  // Deliberately its own app instance (real, un-overridden ThrottlerGuard)
  // so the shared app above — which many other tests log in against far
  // more than this threshold as part of their own setup — doesn't have to
  // be throttling-aware.
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registeredEmails: string[] = [];
  const loginLimit = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? '5');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (registeredEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: registeredEmails } },
      });
    }
    await app.close();
  });

  it('AC30: the request beyond the configured per-IP limit within the window gets 429 + Retry-After; AC31: a subsequent request after the window resets processes normally', async () => {
    const email = `ratelimit-${Date.now()}@example.com`;
    const password = 'correcthorse1';
    registeredEmails.push(email);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Rate Limit Fixture' })
      .expect(201);

    for (let i = 0; i < loginLimit; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
    }

    const throttledResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(429);
    expect(throttledResponse.headers['retry-after']).toBeDefined();

    // AC31: simulate the rolling window having elapsed (rather than a real
    // multi-second sleep) by clearing the in-memory throttler storage this
    // isolated app instance owns — a subsequent request is then processed
    // normally again.
    const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    storage.storage.clear();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
  });
});
