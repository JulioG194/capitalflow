import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PortfolioNotFoundException } from '../../common/exceptions/portfolio-not-found.exception';
import { PortfolioService } from './portfolio.service';

interface PortfolioRecord {
  id: string;
  userId: string;
  cashBalance: Prisma.Decimal;
  createdAt: Date;
}

interface HoldingRecord {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: Prisma.Decimal;
  averagePrice: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaMock {
  portfolio: {
    findUnique: jest.Mock<Promise<PortfolioRecord | null>, [unknown]>;
  };
  holding: { findMany: jest.Mock<Promise<HoldingRecord[]>, [unknown]> };
  transaction: {
    aggregate: jest.Mock<
      Promise<{ _sum: { amount: Prisma.Decimal | null } }>,
      [unknown]
    >;
  };
}

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prisma: PrismaMock;
  let redis: { get: jest.Mock<Promise<string | null>, [string]> };

  function portfolioRecord(
    overrides: Partial<PortfolioRecord> = {},
  ): PortfolioRecord {
    return {
      id: 'portfolio-1',
      userId: 'user-1',
      cashBalance: new Prisma.Decimal('10000.00'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  function holdingRecord(
    overrides: Partial<HoldingRecord> = {},
  ): HoldingRecord {
    return {
      id: 'holding-1',
      portfolioId: 'portfolio-1',
      symbol: 'AAPL',
      quantity: new Prisma.Decimal('10'),
      averagePrice: new Prisma.Decimal('150.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      portfolio: {
        findUnique: jest.fn<Promise<PortfolioRecord | null>, [unknown]>(),
      },
      holding: {
        findMany: jest
          .fn<Promise<HoldingRecord[]>, [unknown]>()
          .mockResolvedValue([]),
      },
      transaction: {
        aggregate: jest
          .fn<Promise<{ _sum: { amount: Prisma.Decimal | null } }>, [unknown]>()
          .mockResolvedValue({
            _sum: { amount: new Prisma.Decimal('10000.00') },
          }),
      },
    };
    redis = {
      get: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(PortfolioService);
  });

  describe('getSummary', () => {
    it('AC4: zero holdings baseline — totalBalance equals cashBalance, zero profit/ROI, 100% cash allocation', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());

      const result = await service.getSummary('user-1');

      expect(result.cashBalance).toBe('10000.00');
      expect(result.holdingsValue).toBe('0.00');
      expect(result.totalBalance).toBe('10000.00');
      expect(result.totalProfit).toBe('0.00');
      expect(result.roiPercent).toBe('0.00');
      expect(result.allocation).toEqual([
        { assetClass: 'cash', value: '10000.00', percentage: '100.00' },
      ]);
    });

    it('AC5: holdingsValue is quantity * currentPrice, totalBalance = cash + holdingsValue', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(
        portfolioRecord({ cashBalance: new Prisma.Decimal('5000.00') }),
      );
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({ symbol: 'AAPL', quantity: new Prisma.Decimal('10') }),
      ]);
      // No cache entry -> falls back to averagePrice ("150.00").
      redis.get.mockResolvedValue(null);

      const result = await service.getSummary('user-1');

      expect(result.holdingsValue).toBe('1500.00');
      expect(result.totalBalance).toBe('6500.00');
    });

    it('AC5: uses the fresh cached price when available, not averagePrice', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(
        portfolioRecord({ cashBalance: new Prisma.Decimal('0.00') }),
      );
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({ symbol: 'AAPL', quantity: new Prisma.Decimal('10') }),
      ]);
      redis.get.mockResolvedValue(JSON.stringify({ price: '200.00' }));

      const result = await service.getSummary('user-1');

      expect(result.holdingsValue).toBe('2000.00');
    });

    it('AC6: allocation has one slice per asset class, remainder assigned to the largest, percentages sum to 100.00', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(
        portfolioRecord({ cashBalance: new Prisma.Decimal('0.00') }),
      );
      // Three equal-value holdings across three distinct asset classes:
      // 100.00/300.00*100 = 33.3333...% each, which rounds to 33.33 three
      // times (sum 99.99) — the remainder (0.01) must land on exactly one
      // slice for the total to be exactly 100.00. Tied values fall back to
      // insertion order (AC6/Implementation Notes), so the first-queried
      // holding's class (equity, AAPL) gets it.
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({
          symbol: 'AAPL',
          quantity: new Prisma.Decimal('1'),
          averagePrice: new Prisma.Decimal('100.00'),
        }),
        holdingRecord({
          symbol: 'SPY',
          quantity: new Prisma.Decimal('1'),
          averagePrice: new Prisma.Decimal('100.00'),
        }),
        holdingRecord({
          symbol: 'BINANCE:BTCUSDT',
          quantity: new Prisma.Decimal('1'),
          averagePrice: new Prisma.Decimal('100.00'),
        }),
      ]);
      redis.get.mockResolvedValue(null);

      const result = await service.getSummary('user-1');

      expect(result.allocation).toHaveLength(3);
      const sum = result.allocation.reduce(
        (total, slice) => total + Number(slice.percentage),
        0,
      );
      expect(sum).toBeCloseTo(100, 2);
      expect(
        result.allocation.find((slice) => slice.assetClass === 'equity')
          ?.percentage,
      ).toBe('33.34');
      expect(
        result.allocation.find((slice) => slice.assetClass === 'etf')
          ?.percentage,
      ).toBe('33.33');
      expect(
        result.allocation.find((slice) => slice.assetClass === 'crypto')
          ?.percentage,
      ).toBe('33.33');
    });

    it('AC7: totalBalance of 0.00 returns a single cash slice without dividing by zero', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(
        portfolioRecord({ cashBalance: new Prisma.Decimal('0.00') }),
      );
      prisma.holding.findMany.mockResolvedValue([]);

      const result = await service.getSummary('user-1');

      expect(result.allocation).toEqual([
        { assetClass: 'cash', value: '0.00', percentage: '0.00' },
      ]);
    });

    it('AC8: roiPercent has no leading sign for zero or positive, "-" for negative', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(
        portfolioRecord({ cashBalance: new Prisma.Decimal('9500.00') }),
      );
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('10000.00') },
      });

      const result = await service.getSummary('user-1');

      expect(result.totalProfit).toBe('-500.00');
      expect(result.roiPercent).toBe('-5.00');
    });

    it('AC8: guards against a zero totalDeposited instead of NaN/Infinity', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.getSummary('user-1');

      expect(result.roiPercent).toBe('0.00');
      expect(result.totalDeposited).toBe('0.00');
    });

    it('AC9: includes an asOf ISO-8601 timestamp', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());

      const result = await service.getSummary('user-1');

      expect(() => new Date(result.asOf).toISOString()).not.toThrow();
      expect(new Date(result.asOf).toISOString()).toBe(result.asOf);
    });

    it('AC10: throws PortfolioNotFoundException when the user has no Portfolio row', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(null);

      await expect(
        service.getSummary('user-without-portfolio'),
      ).rejects.toBeInstanceOf(PortfolioNotFoundException);
    });
  });

  describe('getHoldings', () => {
    it('AC12: returns a bare array sorted by marketValue descending', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({
          symbol: 'AAPL',
          quantity: new Prisma.Decimal('1'),
          averagePrice: new Prisma.Decimal('100.00'),
        }),
        holdingRecord({
          symbol: 'SPY',
          quantity: new Prisma.Decimal('10'),
          averagePrice: new Prisma.Decimal('50.00'),
        }),
      ]);
      redis.get.mockResolvedValue(null);

      const result = await service.getHoldings('user-1');

      expect(result.map((h) => h.symbol)).toEqual(['SPY', 'AAPL']);
    });

    it('AC12: returns an empty array (not 404) when there are no holdings', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
      prisma.holding.findMany.mockResolvedValue([]);

      const result = await service.getHoldings('user-1');

      expect(result).toEqual([]);
    });

    it('AC13: uses the fresh cached price and marks isPriceStale false on a cache hit', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({
          symbol: 'AAPL',
          quantity: new Prisma.Decimal('10'),
          averagePrice: new Prisma.Decimal('150.00'),
        }),
      ]);
      redis.get.mockResolvedValue(JSON.stringify({ price: '200.00' }));

      const [holding] = await service.getHoldings('user-1');

      expect(holding?.currentPrice).toBe('200.00');
      expect(holding?.isPriceStale).toBe(false);
      expect(holding?.marketValue).toBe('2000.00');
    });

    it.each([
      ['a cache miss', null],
      ['a malformed cache entry', 'not-json'],
      ['an entry with no price field', JSON.stringify({ timestamp: 'x' })],
    ])(
      'AC14: falls back to averagePrice and marks isPriceStale true on %s',
      async (_label, cachedValue) => {
        prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
        prisma.holding.findMany.mockResolvedValue([
          holdingRecord({
            symbol: 'AAPL',
            quantity: new Prisma.Decimal('10'),
            averagePrice: new Prisma.Decimal('150.00'),
          }),
        ]);
        redis.get.mockResolvedValue(cachedValue);

        const [holding] = await service.getHoldings('user-1');

        expect(holding?.currentPrice).toBe('150.00');
        expect(holding?.isPriceStale).toBe(true);
      },
    );

    it('AC15: resolves an unmapped symbol to assetClass "other" instead of throwing', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRecord());
      prisma.holding.findMany.mockResolvedValue([
        holdingRecord({ symbol: 'UNKNOWN_SYMBOL' }),
      ]);
      redis.get.mockResolvedValue(null);

      const [holding] = await service.getHoldings('user-1');

      expect(holding?.assetClass).toBe('other');
    });

    it('AC10: throws PortfolioNotFoundException when the user has no Portfolio row', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(null);

      await expect(
        service.getHoldings('user-without-portfolio'),
      ).rejects.toBeInstanceOf(PortfolioNotFoundException);
    });
  });
});
