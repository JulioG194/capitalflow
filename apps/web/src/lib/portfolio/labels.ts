import type { AssetClass, TransactionStatus, TransactionType } from "@capitalflow/shared-types";

/** Spanish display labels for `AssetClass` (spec 001 precedent: no non-`es` copy). */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Acciones",
  etf: "ETF",
  crypto: "Cripto",
  cash: "Efectivo",
  other: "Otro",
};

/** Spanish display labels for `TransactionType`. */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Compra",
  sell: "Venta",
  deposit: "Depósito",
};

/** Spanish display labels for `TransactionStatus`. */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pendiente",
  completed: "Completada",
  failed: "Fallida",
};
