import type { AssetClass, TransactionStatus, TransactionType } from "@capitalflow/shared-types";

/** English display labels for `AssetClass` (spec 001: default `en` locale). */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equities",
  etf: "ETF",
  crypto: "Crypto",
  cash: "Cash",
  other: "Other",
};

/** English display labels for `TransactionType`. */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  deposit: "Deposit",
};

/** English display labels for `TransactionStatus`. */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
};
