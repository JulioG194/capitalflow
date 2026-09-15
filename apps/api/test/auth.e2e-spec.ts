import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';

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
});
