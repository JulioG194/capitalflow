import { Injectable } from '@nestjs/common';
import {
  SYMBOL_ASSET_CLASS,
  type AllocationSliceDto,
  type AssetClass,
  type PortfolioSummaryDto,
} from '@capitalflow/shared-types';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PortfolioNotFoundException } from '../../common/exceptions/portfolio-not-found.exception';

interface CachedQuote {
  price?: string;
}

interface HoldingRecord {
  symbol: string;
  quantity: Prisma.Decimal;
  averagePrice: Prisma.Decimal;
}

export interface ValuedHolding {
  symbol: string;
  assetClass: AssetClass;
  quantity: Prisma.Decimal;
  averagePrice: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  isPriceStale: boolean;
  marketValue: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

/**
 * Spec 004 section 4, design decision 2: this service never calls Finnhub —
 * it only reads apps/market-stream's Redis cache (via `RedisService`) and
 * falls back to `averagePrice` on any miss (cache miss, TTL expiry, or
 * Redis being unreachable are all treated identically, AC13/AC14).
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSummary(userId: string): Promise<PortfolioSummaryDto> {
    const portfolio = await this.findPortfolioOrThrow(userId);
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId: portfolio.id },
    });
    const valued = await this.valuateHoldings(holdings);

    const holdingsValue = valued.reduce(
      (sum, holding) => sum.plus(holding.marketValue),
      ZERO,
    );
    const totalBalance = portfolio.cashBalance.plus(holdingsValue);

    const depositAggregate = await this.prisma.transaction.aggregate({
      where: { portfolioId: portfolio.id, type: 'deposit' },
      _sum: { amount: true },
    });
    const totalDeposited = depositAggregate._sum.amount ?? ZERO;

    const totalProfit = totalBalance.minus(totalDeposited);
    const roiPercent = totalDeposited.isZero()
      ? '0.00'
      : this.formatSigned(totalProfit.dividedBy(totalDeposited).times(100));

    const allocation = this.computeAllocation(
      valued,
      portfolio.cashBalance,
      totalBalance,
    );

    return {
      cashBalance: portfolio.cashBalance.toFixed(2),
      holdingsValue: holdingsValue.toFixed(2),
      totalBalance: totalBalance.toFixed(2),
      totalDeposited: totalDeposited.toFixed(2),
      totalProfit: this.formatSigned(totalProfit),
      roiPercent,
      allocation,
      asOf: new Date().toISOString(),
    };
  }

  /** AC10: shared by all three portfolio endpoints. */
  async findPortfolioOrThrow(userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
    });
    if (!portfolio) {
      throw new PortfolioNotFoundException();
    }
    return portfolio;
  }

  /** AC12-15: current-price lookup + staleness + asset-class resolution. */
  async valuateHoldings(holdings: HoldingRecord[]): Promise<ValuedHolding[]> {
    return Promise.all(
      holdings.map(async (holding) => {
        const cached = await this.redis.get(`market:quote:${holding.symbol}`);
        let currentPrice = holding.averagePrice;
        let isPriceStale = true;

        const parsedPrice = this.parseCachedPrice(cached);
        if (parsedPrice) {
          currentPrice = parsedPrice;
          isPriceStale = false;
        }

        const assetClass: AssetClass =
          SYMBOL_ASSET_CLASS[holding.symbol] ?? 'other';

        return {
          symbol: holding.symbol,
          assetClass,
          quantity: holding.quantity,
          averagePrice: holding.averagePrice,
          currentPrice,
          isPriceStale,
          marketValue: holding.quantity.times(currentPrice),
        };
      }),
    );
  }

  private parseCachedPrice(cached: string | null): Prisma.Decimal | null {
    if (!cached) {
      return null;
    }
    try {
      const parsed = JSON.parse(cached) as CachedQuote;
      return parsed.price ? new Prisma.Decimal(parsed.price) : null;
    } catch {
      // Malformed cache entry — treated identically to a miss (AC14).
      return null;
    }
  }

  /**
   * AC6/AC7: one slice per asset class present (including "cash" whenever
   * `cashBalance > 0`), rounded to 2 decimals with the rounding remainder
   * assigned to the largest slice (stable tie-break: first by insertion
   * order — cash first, then holdings in the order they were queried).
   */
  private computeAllocation(
    valuedHoldings: ValuedHolding[],
    cashBalance: Prisma.Decimal,
    totalBalance: Prisma.Decimal,
  ): AllocationSliceDto[] {
    if (totalBalance.isZero()) {
      return [{ assetClass: 'cash', value: '0.00', percentage: '0.00' }];
    }

    const valueByClass = new Map<AssetClass, Prisma.Decimal>();
    if (cashBalance.greaterThan(0)) {
      valueByClass.set('cash', cashBalance);
    }
    for (const holding of valuedHoldings) {
      const existing = valueByClass.get(holding.assetClass) ?? ZERO;
      valueByClass.set(holding.assetClass, existing.plus(holding.marketValue));
    }

    const classes = [...valueByClass.keys()];
    const rawPercentages = classes.map((assetClass) =>
      (valueByClass.get(assetClass) as Prisma.Decimal)
        .dividedBy(totalBalance)
        .times(100)
        .toDecimalPlaces(2),
    );

    const roundedSum = rawPercentages.reduce(
      (sum, percentage) => sum.plus(percentage),
      ZERO,
    );
    const remainder = new Prisma.Decimal(100).minus(roundedSum);

    let largestIndex = 0;
    let largestValue = valueByClass.get(classes[0]) as Prisma.Decimal;
    for (let i = 1; i < classes.length; i += 1) {
      const value = valueByClass.get(classes[i]) as Prisma.Decimal;
      if (value.greaterThan(largestValue)) {
        largestValue = value;
        largestIndex = i;
      }
    }

    return classes.map((assetClass, i) => ({
      assetClass,
      value: (valueByClass.get(assetClass) as Prisma.Decimal).toFixed(2),
      percentage: (i === largestIndex
        ? rawPercentages[i].plus(remainder)
        : rawPercentages[i]
      ).toFixed(2),
    }));
  }

  /** AC8: no leading sign for zero, "-" for negative, none for positive. */
  private formatSigned(value: Prisma.Decimal): string {
    const rounded = value.toDecimalPlaces(2);
    return rounded.isZero() ? '0.00' : rounded.toFixed(2);
  }
}
