import { z } from 'zod';

export type AssetClass = 'equity' | 'etf' | 'crypto' | 'cash' | 'other';

/**
 * Maps every symbol in spec 003's `MARKET_SYMBOL_GROUPS` to an asset class
 * (spec 004 section 4, design decision 1). A symbol absent from this map
 * resolves to `"other"` at read time, never throws.
 */
export const SYMBOL_ASSET_CLASS: Record<
  string,
  Exclude<AssetClass, 'cash' | 'other'>
> = {
  AAPL: 'equity',
  MSFT: 'equity',
  GOOGL: 'equity',
  AMZN: 'equity',
  TSLA: 'equity',
  NVDA: 'equity',
  SPY: 'etf',
  QQQ: 'etf',
  DIA: 'etf',
  'BINANCE:BTCUSDT': 'crypto',
};

export type TransactionType = 'buy' | 'sell' | 'deposit';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface AllocationSliceDto {
  assetClass: AssetClass;
  value: string;
  percentage: string; // 2 decimals, e.g. "42.50"
}

export interface PortfolioSummaryDto {
  cashBalance: string;
  holdingsValue: string;
  totalBalance: string;
  totalDeposited: string;
  totalProfit: string;
  roiPercent: string; // "-3.42" | "0.00" | "3.42"
  allocation: AllocationSliceDto[];
  asOf: string; // ISO 8601
}

export interface HoldingDto {
  symbol: string;
  assetClass: AssetClass;
  quantity: string;
  averagePrice: string;
  currentPrice: string;
  isPriceStale: boolean;
  marketValue: string;
  unrealizedProfit: string;
  unrealizedProfitPercent: string; // 2 decimals, signed like roiPercent
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  symbol: string | null;
  quantity: string | null;
  price: string | null;
  amount: string;
  status: TransactionStatus;
  createdAt: string; // ISO 8601
}

export interface PaginatedTransactionsDto {
  items: TransactionDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * `?page=&limit=` for `GET /portfolio/transactions` (spec 004 AC16-19).
 * `limit` above 100 is clamped in the service, not rejected here — this
 * schema only rejects structurally invalid values (non-numeric, `< 1`).
 */
export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(20),
});
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
