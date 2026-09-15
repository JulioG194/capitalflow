import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import IORedis from 'ioredis';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { PortfolioModule } from './../src/modules/portfolio/portfolio.module';
import { EmailService } from './../src/modules/auth/email/email.service';

interface LoginResponseBody {
  accessToken: string;
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

/**
 * A dedicated raw Redis client that writes the same `market:quote:<symbol>`
 * shape apps/market-stream caches (spec 004 section 4), so these tests can
 * pin a fresh purchase price without needing a live Finnhub connection —
 * apps/api itself never writes to this key in production.
 */
const redisClient = new IORedis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
);

async function setFreshPrice(symbol: string, price: string): Promise<void> {
  await redisClient.set(`market:quote:${symbol}`, JSON.stringify({ price }));
}

async function clearPrice(symbol: string): Promise<void> {
  await redisClient.del(`market:quote:${symbol}`);
}

describe('POST /portfolio/invest (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registeredEmails: string[] = [];
  const sendPasswordResetEmail = jest
    .fn<Promise<void>, [{ to: string; resetLink: string }]>()
    .mockResolvedValue(undefined);
  const usedSymbols = new Set<string>();

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
      // This shared instance only needs to bypass the *login* throttle
      // (many tests below log in); `InvestThrottlerGuard` — a distinct
      // class from `ThrottlerGuard` — is intentionally left real so every
      // invest call here is subject to its actual per-user limit. Each
      // test below uses its own freshly registered user, so none of them
      // individually approach the 30/hour default.
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
    await Promise.all([...usedSymbols].map((symbol) => clearPrice(symbol)));
    await redisClient.quit();
    await app.close();
  });

  it('AC1/AC8/AC10/AC11/AC17: succeeds with 201, deducts cashBalance, creates a Holding and a completed buy Transaction, all monetary/quantity fields as strings', async () => {
    const email = `invest-ac1-${Date.now()}@example.com`;
    registeredEmails.push(email);
    usedSymbols.add('AAPL');
    const accessToken = await registerAndLogin(email);
    await setFreshPrice('AAPL', '100.00');

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '1000.00' })
      .expect(201);

    const body = response.body as PortfolioSummaryResponseBody;
    expect(body.cashBalance).toBe('9000.00');
    expect(body.holdingsValue).toBe('1000.00');
    expect(body.totalBalance).toBe('10000.00');
    // AC17: every monetary/quantity field in the response is a string.
    expect(typeof body.cashBalance).toBe('string');
    expect(typeof body.holdingsValue).toBe('string');
    expect(typeof body.totalBalance).toBe('string');
    expect(typeof body.totalDeposited).toBe('string');
    expect(typeof body.totalProfit).toBe('string');
    expect(typeof body.roiPercent).toBe('string');
    for (const slice of body.allocation) {
      expect(typeof slice.value).toBe('string');
      expect(typeof slice.percentage).toBe('string');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const holdings = await prisma.holding.findMany({
      where: { portfolioId: portfolio.id },
    });
    expect(holdings).toHaveLength(1);
    expect(holdings[0]?.symbol).toBe('AAPL');
    expect(holdings[0]?.quantity.toFixed(6)).toBe('10.000000');
    expect(holdings[0]?.averagePrice.toFixed(2)).toBe('100.00');

    const transactions = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id, type: 'buy' },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      symbol: 'AAPL',
      status: 'completed',
    });
    expect(transactions[0]?.quantity?.toFixed(6)).toBe('10.000000');
    expect(transactions[0]?.price?.toFixed(2)).toBe('100.00');
    expect(transactions[0]?.amount.toFixed(2)).toBe('1000.00');
  });

  it('AC9: a second invest into an already-held symbol updates the existing Holding in place (never a second row)', async () => {
    const email = `invest-ac9-${Date.now()}@example.com`;
    registeredEmails.push(email);
    usedSymbols.add('MSFT');
    const accessToken = await registerAndLogin(email);
    await setFreshPrice('MSFT', '50.00');

    await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'MSFT', amount: '500.00' })
      .expect(201);

    await setFreshPrice('MSFT', '100.00');
    await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'MSFT', amount: '500.00' })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const holdings = await prisma.holding.findMany({
      where: { portfolioId: portfolio.id, symbol: 'MSFT' },
    });
    expect(holdings).toHaveLength(1);
    // quantity: 500/50=10, 500/100=5 -> 15 total.
    expect(holdings[0]?.quantity.toFixed(6)).toBe('15.000000');
    // averagePrice: (10*50 + 5*100)/15 = 1000/15 = 66.666... -> 66.67.
    expect(holdings[0]?.averagePrice.toFixed(2)).toBe('66.67');
  });

  it("AC2: rejects a symbol outside the investable set with 400 (collapsed with AC3 by investSchema's z.enum)", async () => {
    const email = `invest-ac2-${Date.now()}@example.com`;
    registeredEmails.push(email);
    const accessToken = await registerAndLogin(email);

    await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'NOT_A_REAL_SYMBOL', amount: '100.00' })
      .expect(400);
  });

  it('AC3: rejects a zero amount with 400 field-level validation before any business logic runs', async () => {
    const email = `invest-ac3-${Date.now()}@example.com`;
    registeredEmails.push(email);
    const accessToken = await registerAndLogin(email);

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '0.00' })
      .expect(400);

    expect((response.body as ErrorResponseBody).code).toBe('VALIDATION_ERROR');

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(portfolio.cashBalance.toFixed(2)).toBe('10000.00');
  });

  it('AC4: rejects a well-formed amount below "1.00" with 400 AMOUNT_BELOW_MINIMUM', async () => {
    const email = `invest-ac4-${Date.now()}@example.com`;
    registeredEmails.push(email);
    const accessToken = await registerAndLogin(email);

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '0.50' })
      .expect(400);

    expect((response.body as ErrorResponseBody).code).toBe(
      'AMOUNT_BELOW_MINIMUM',
    );
  });

  it('AC5: rejects with 422 INSUFFICIENT_FUNDS when cashBalance < amount, leaving cashBalance/Transaction/Holding unchanged', async () => {
    const email = `invest-ac5-${Date.now()}@example.com`;
    registeredEmails.push(email);
    usedSymbols.add('GOOGL');
    const accessToken = await registerAndLogin(email);
    await setFreshPrice('GOOGL', '10.00');

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'GOOGL', amount: '20000.00' })
      .expect(422);

    expect((response.body as ErrorResponseBody).code).toBe(
      'INSUFFICIENT_FUNDS',
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(portfolio.cashBalance.toFixed(2)).toBe('10000.00');

    const holdings = await prisma.holding.findMany({
      where: { portfolioId: portfolio.id },
    });
    expect(holdings).toHaveLength(0);

    const buyTransactions = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id, type: 'buy' },
    });
    expect(buyTransactions).toHaveLength(0);
  });

  it('AC7: rejects with 503 PRICE_UNAVAILABLE when no fresh cached price exists, writing no partial state', async () => {
    const email = `invest-ac7-${Date.now()}@example.com`;
    registeredEmails.push(email);
    // TSLA is deliberately never cached by this suite.
    const accessToken = await registerAndLogin(email);
    await clearPrice('TSLA');

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'TSLA', amount: '100.00' })
      .expect(503);

    expect((response.body as ErrorResponseBody).code).toBe('PRICE_UNAVAILABLE');

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(portfolio.cashBalance.toFixed(2)).toBe('10000.00');
  });

  it('AC12: responds 404 PORTFOLIO_NOT_FOUND when the authenticated user has no Portfolio row', async () => {
    const email = `invest-ac12-${Date.now()}@example.com`;
    registeredEmails.push(email);
    const accessToken = await registerAndLogin(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.portfolio.delete({ where: { userId: user.id } });

    const response = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '100.00' })
      .expect(404);

    expect((response.body as ErrorResponseBody).code).toBe(
      'PORTFOLIO_NOT_FOUND',
    );
  });

  it('AC13: rejects a request with no access token with 401', async () => {
    await request(app.getHttpServer())
      .post('/portfolio/invest')
      .send({ symbol: 'AAPL', amount: '100.00' })
      .expect(401);
  });

  it('AC6: exactly one of two concurrent invest requests against a fixed balance succeeds', async () => {
    const email = `invest-ac6-${Date.now()}@example.com`;
    registeredEmails.push(email);
    usedSymbols.add('NVDA');
    const accessToken = await registerAndLogin(email);
    await setFreshPrice('NVDA', '10.00');

    // Starting cashBalance is the $10,000 registration grant. Two
    // concurrent requests for $6,000 each individually fit, but their sum
    // ($12,000) exceeds the balance — the atomic conditional update (AC6)
    // must let exactly one through.
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/portfolio/invest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ symbol: 'NVDA', amount: '6000.00' }),
      request(app.getHttpServer())
        .post('/portfolio/invest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ symbol: 'NVDA', amount: '6000.00' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(portfolio.cashBalance.toFixed(2)).toBe('4000.00');

    const buyTransactions = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id, type: 'buy' },
    });
    expect(buyTransactions).toHaveLength(1);
  });
});

describe('POST /portfolio/invest rate limiting (AC14/AC15)', () => {
  // Deliberately its own app instance (real, un-overridden guards) so the
  // shared app above — which many other tests in this suite call far less
  // than this threshold, but always as fresh per-user calls — doesn't have
  // to be throttling-aware.
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registeredEmails: string[] = [];
  const investLimit = Number(process.env.INVEST_RATE_LIMIT_MAX ?? '30');

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'correcthorse1', name: 'Rate Limit Fixture' })
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

  it('AC14: the request beyond the configured per-user limit within the window gets 429 + Retry-After, running no invest logic; AC15: a subsequent request after the window resets processes normally', async () => {
    const email = `invest-ratelimit-${Date.now()}@example.com`;
    registeredEmails.push(email);
    const accessToken = await registerAndLogin(email);

    // Every attempt uses a below-minimum amount so it fails fast on AC4
    // without needing a cached price — AC14 counts requests "successful or
    // failed" toward the limit.
    for (let i = 0; i < investLimit; i += 1) {
      await request(app.getHttpServer())
        .post('/portfolio/invest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ symbol: 'AAPL', amount: '0.50' })
        .expect(400);
    }

    const throttledResponse = await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '0.50' })
      .expect(429);
    expect(throttledResponse.headers['retry-after']).toBeDefined();

    // AC15: simulate the rolling window having elapsed (rather than a real
    // multi-second sleep) by clearing the in-memory throttler storage this
    // isolated app instance owns. `ThrottlerStorage` is now a plain,
    // module-local provider on `PortfolioModule` (see portfolio.module.ts),
    // so `.select(PortfolioModule)` deterministically resolves the exact
    // instance `InvestThrottlerGuard` reads from — a bare `app.get(...)`
    // would be ambiguous since `AuthModule` also binds this same token for
    // its own (separate) login throttle.
    const storage = app
      .select(PortfolioModule)
      .get<ThrottlerStorageService>(ThrottlerStorage, { strict: true });
    storage.storage.clear();

    await request(app.getHttpServer())
      .post('/portfolio/invest')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ symbol: 'AAPL', amount: '0.50' })
      .expect(400);
  });
});
