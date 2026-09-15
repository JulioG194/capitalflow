import { Injectable } from '@nestjs/common';
import {
  SYMBOL_ASSET_CLASS,
  type AllocationSliceDto,
  type AssetClass,
  type HoldingDto,
  type PaginatedTransactionsDto,
  type PortfolioSummaryDto,
  type TransactionDto,
} from '@capitalflow/shared-types';
import { Prisma, type Transaction } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PortfolioNotFoundException } from '../../common/exceptions/portfolio-not-found.exception';
import { AmountBelowMinimumException } from '../../common/exceptions/amount-below-minimum.exception';
import { InsufficientFundsException } from '../../common/exceptions/insufficient-funds.exception';
import { PriceUnavailableException } from '../../common/exceptions/price-unavailable.exception';

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

/** AC18: limit above this is clamped, not rejected. */
const MAX_TRANSACTIONS_LIMIT = 100;

/** Spec 005 design decision 4: pinned business minimum for a single invest. */
const MIN_INVEST_AMOUNT = new Prisma.Decimal('1.00');

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
      // AC6's rounding-remainder tie-break is documented as "stable
      // insertion order" — an explicit orderBy makes that guarantee real
      // at the DB layer instead of relying on Postgres's incidental
      // (unspecified) row order for a query with no ORDER BY.
      orderBy: { createdAt: 'asc' },
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

  /** AC12: sorted by marketValue descending; empty array when no holdings. */
  async getHoldings(userId: string): Promise<HoldingDto[]> {
    const portfolio = await this.findPortfolioOrThrow(userId);
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { createdAt: 'asc' },
    });
    const valued = await this.valuateHoldings(holdings);

    return [...valued]
      .sort((a, b) => b.marketValue.comparedTo(a.marketValue))
      .map((holding) => this.toHoldingDto(holding));
  }

  private toHoldingDto(holding: ValuedHolding): HoldingDto {
    const costBasis = holding.quantity.times(holding.averagePrice);
    const unrealizedProfit = holding.marketValue.minus(costBasis);
    const unrealizedProfitPercent = costBasis.isZero()
      ? '0.00'
      : this.formatSigned(unrealizedProfit.dividedBy(costBasis).times(100));

    return {
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      quantity: holding.quantity.toString(),
      averagePrice: holding.averagePrice.toFixed(2),
      currentPrice: holding.currentPrice.toFixed(2),
      isPriceStale: holding.isPriceStale,
      marketValue: holding.marketValue.toFixed(2),
      unrealizedProfit: this.formatSigned(unrealizedProfit),
      unrealizedProfitPercent,
    };
  }

  /**
   * AC16-21: `page`/`limit` are already coerced to positive integers by
   * `transactionsQuerySchema` (structurally invalid values are 400s before
   * this method runs); `limit` above `MAX_TRANSACTIONS_LIMIT` is clamped
   * here rather than rejected (AC18, a valid business case).
   */
  async getTransactions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedTransactionsDto> {
    const portfolio = await this.findPortfolioOrThrow(userId);
    const clampedLimit = Math.min(limit, MAX_TRANSACTIONS_LIMIT);

    const [records, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { portfolioId: portfolio.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * clampedLimit,
        take: clampedLimit,
      }),
      this.prisma.transaction.count({ where: { portfolioId: portfolio.id } }),
    ]);

    return {
      items: records.map((record) => this.toTransactionDto(record)),
      page,
      limit: clampedLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / clampedLimit),
    };
  }

  /**
   * Spec 005: commits simulated cash to a symbol. AC1/AC8-AC11: on success,
   * exactly one `Transaction` (`type: "buy"`) is created and the matching
   * `Holding` is created or weighted-average-updated, inside one
   * `prisma.$transaction` so a failure partway rolls back every write
   * (implementation notes section 7).
   */
  async invest(
    userId: string,
    symbol: string,
    amount: string,
  ): Promise<PortfolioSummaryDto> {
    // AC12: no Portfolio row is a data-integrity 404, checked first.
    const portfolio = await this.findPortfolioOrThrow(userId);

    // AC2/AC3: symbol enum membership and amount format are already
    // guaranteed by `investSchema`'s `ZodValidationPipe` before this method
    // runs — only the business-rule minimum is this method's job (AC4).
    const amountDecimal = new Prisma.Decimal(amount);
    if (amountDecimal.lessThan(MIN_INVEST_AMOUNT)) {
      throw new AmountBelowMinimumException();
    }

    // AC7/design decision 1: a cache miss/expiry/Redis-down all reject the
    // request outright — never fall back to a holding's `averagePrice` the
    // way the read-only valuation methods above do.
    const cached = await this.redis.get(`market:quote:${symbol}`);
    const purchasePrice = this.parseCachedPrice(cached)?.toDecimalPlaces(2);
    if (!purchasePrice) {
      throw new PriceUnavailableException();
    }

    // AC5: purchased quantity rounded half-up to 6 decimals; the amount
    // actually deducted from cashBalance is always the exact requested
    // value, never recomputed from this rounded quantity (section 4,
    // design decision 5).
    const purchasedQuantity = amountDecimal
      .dividedBy(purchasePrice)
      .toDecimalPlaces(6);

    await this.prisma.$transaction(async (tx) => {
      // AC5/AC6/design decision 2: balance check + deduction as one atomic
      // conditional update — never a separate read followed by a write, so
      // two concurrent requests can never both succeed against the same
      // balance.
      const deduction = await tx.portfolio.updateMany({
        where: { id: portfolio.id, cashBalance: { gte: amountDecimal } },
        data: { cashBalance: { decrement: amountDecimal } },
      });
      if (deduction.count === 0) {
        throw new InsufficientFundsException();
      }

      const existingHolding = await tx.holding.findUnique({
        where: {
          portfolioId_symbol: { portfolioId: portfolio.id, symbol },
        },
      });

      if (existingHolding) {
        // AC9: weighted-average update in place — never a second row for
        // the same (portfolioId, symbol).
        const newQuantity = existingHolding.quantity.plus(purchasedQuantity);
        const newAveragePrice = existingHolding.quantity
          .times(existingHolding.averagePrice)
          .plus(purchasedQuantity.times(purchasePrice))
          .dividedBy(newQuantity)
          .toDecimalPlaces(2);

        await tx.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: newQuantity, averagePrice: newAveragePrice },
        });
      } else {
        // AC8: exactly one new Holding row for a symbol not yet held.
        await tx.holding.create({
          data: {
            portfolioId: portfolio.id,
            symbol,
            quantity: purchasedQuantity,
            averagePrice: purchasePrice,
          },
        });
      }

      // AC10: exactly one new completed "buy" Transaction row.
      await tx.transaction.create({
        data: {
          portfolioId: portfolio.id,
          type: 'buy',
          symbol,
          quantity: purchasedQuantity,
          price: purchasePrice,
          amount: amountDecimal,
          status: 'completed',
        },
      });
    });

    // AC1/AC17: reuses the exact PortfolioSummaryDto shape spec 004 already
    // defined, now reflecting this invest's persisted state.
    return this.getSummary(userId);
  }

  private toTransactionDto(record: Transaction): TransactionDto {
    return {
      id: record.id,
      type: record.type,
      symbol: record.symbol,
      quantity: record.quantity ? record.quantity.toString() : null,
      price: record.price ? record.price.toFixed(2) : null,
      amount: record.amount.toFixed(2),
      status: record.status,
      createdAt: record.createdAt.toISOString(),
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
