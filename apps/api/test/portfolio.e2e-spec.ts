import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { EmailService } from './../src/modules/auth/email/email.service';

interface LoginResponseBody {
  accessToken: string;
}

interface TransactionResponseBody {
  id: string;
  type: string;
  symbol: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  status: string;
  createdAt: string;
}

interface PaginatedTransactionsResponseBody {
  items: TransactionResponseBody[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PortfolioSummaryResponseBody {
  cashBalance: string;
  holdingsValue: string;
  totalBalance: string;
  totalDeposited: string;
  totalProfit: string;
  roiPercent: string;
  allocation: { assetClass: string; value: string; percentage: string }[];
  asOf: string;
}

interface ErrorResponseBody {
  statusCode: number;
  code?: string;
  message: string;
}

describe('Portfolio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registeredEmails: string[] = [];
  const sendPasswordResetEmail = jest
    .fn<Promise<void>, [{ to: string; resetLink: string }]>()
    .mockResolvedValue(undefined);

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'correcthorse1', name: 'Ada Lovelace' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'correcthorse1' })
      .expect(200);

    return (loginResponse.body as LoginResponseBody).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ sendPasswordResetEmail })
      // This suite logs in far more than the real AC30 threshold (5/min)
      // as part of its own setup — login rate limiting itself is covered
      // by auth.e2e-spec.ts's dedicated describe block.
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

  afterAll(async () => {
    if (registeredEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: registeredEmails } },
      });
    }
    await app.close();
  });

  describe('GET /portfolio', () => {
    it('AC4: returns the $10,000 baseline summary for a freshly registered user', async () => {
      const email = `portfolio-ac4-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PortfolioSummaryResponseBody;
      expect(body.cashBalance).toBe('10000.00');
      expect(body.totalBalance).toBe('10000.00');
      expect(body.totalProfit).toBe('0.00');
      expect(body.roiPercent).toBe('0.00');
      expect(body.allocation).toEqual([
        { assetClass: 'cash', value: '10000.00', percentage: '100.00' },
      ]);
      expect(typeof body.asOf).toBe('string');
    });

    it('AC11: rejects a request with no access token with 401', async () => {
      await request(app.getHttpServer()).get('/portfolio').expect(401);
    });

    it('AC11: rejects a request with a malformed access token with 401', async () => {
      await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('AC10: responds 404 PORTFOLIO_NOT_FOUND when the authenticated user has no Portfolio row', async () => {
      const email = `portfolio-ac10-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.portfolio.delete({ where: { userId: user.id } });

      const response = await request(app.getHttpServer())
        .get('/portfolio')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect((response.body as ErrorResponseBody).code).toBe(
        'PORTFOLIO_NOT_FOUND',
      );
    });
  });

  describe('GET /portfolio/holdings', () => {
    it('AC12: returns an empty array (not 404) for a freshly registered user with no holdings', async () => {
      const email = `holdings-ac12-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .get('/portfolio/holdings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('AC11: rejects a request with no access token with 401', async () => {
      await request(app.getHttpServer()).get('/portfolio/holdings').expect(401);
    });

    it('AC10: responds 404 PORTFOLIO_NOT_FOUND when the authenticated user has no Portfolio row', async () => {
      const email = `holdings-ac10-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.portfolio.delete({ where: { userId: user.id } });

      const response = await request(app.getHttpServer())
        .get('/portfolio/holdings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect((response.body as ErrorResponseBody).code).toBe(
        'PORTFOLIO_NOT_FOUND',
      );
    });
  });

  describe('GET /portfolio/transactions', () => {
    it('AC16: defaults to page=1/limit=20 and includes the registration deposit', async () => {
      const email = `transactions-ac16-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .get('/portfolio/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedTransactionsResponseBody;
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.total).toBe(1);
      expect(body.totalPages).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        type: 'deposit',
        symbol: null,
        quantity: null,
        price: null,
        amount: '10000.00',
        status: 'completed',
      });
    });

    it('AC18: clamps limit above 100 to 100 instead of rejecting', async () => {
      const email = `transactions-ac18-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .get('/portfolio/transactions?limit=500')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((response.body as PaginatedTransactionsResponseBody).limit).toBe(
        100,
      );
    });

    it('AC19: rejects a non-numeric page with 400', async () => {
      const email = `transactions-ac19a-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      await request(app.getHttpServer())
        .get('/portfolio/transactions?page=not-a-number')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('AC19: rejects a limit below 1 with 400', async () => {
      const email = `transactions-ac19b-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      await request(app.getHttpServer())
        .get('/portfolio/transactions?limit=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('AC21: a page beyond the last available page responds 200 with an empty items array', async () => {
      const email = `transactions-ac21-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);

      const response = await request(app.getHttpServer())
        .get('/portfolio/transactions?page=999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedTransactionsResponseBody;
      expect(body.items).toEqual([]);
      expect(body.total).toBe(1);
    });

    it('AC11: rejects a request with no access token with 401', async () => {
      await request(app.getHttpServer())
        .get('/portfolio/transactions')
        .expect(401);
    });

    it('AC10: responds 404 PORTFOLIO_NOT_FOUND when the authenticated user has no Portfolio row', async () => {
      const email = `transactions-ac10-${Date.now()}@example.com`;
      registeredEmails.push(email);
      const accessToken = await registerAndLogin(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.portfolio.delete({ where: { userId: user.id } });

      const response = await request(app.getHttpServer())
        .get('/portfolio/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect((response.body as ErrorResponseBody).code).toBe(
        'PORTFOLIO_NOT_FOUND',
      );
    });
  });
});
