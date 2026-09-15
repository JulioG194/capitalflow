import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { hashToken } from './../src/modules/auth/auth.crypto';

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
});
