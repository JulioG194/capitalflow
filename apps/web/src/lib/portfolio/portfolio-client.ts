import type {
  HoldingDto,
  PaginatedTransactionsDto,
  PortfolioSummaryDto,
} from "@capitalflow/shared-types";
import { apiFetch } from "@/lib/auth/api-client";
import { ApiError } from "@/lib/auth/errors";

const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Inténtalo de nuevo.";

interface ErrorBody {
  message?: unknown;
  code?: unknown;
}

/**
 * Parses a JSON body and throws `ApiError` on a non-2xx response — the same
 * shape as `lib/auth/auth-client.ts`'s `parseJsonOrThrow`, duplicated here
 * (not imported) because that helper isn't exported and this module has no
 * other reason to depend on the auth-client module beyond `apiFetch`/`ApiError`.
 */
async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = (body ?? {}) as ErrorBody;
    const message =
      typeof errorBody.message === "string" ? errorBody.message : GENERIC_ERROR_MESSAGE;
    const code = typeof errorBody.code === "string" ? errorBody.code : undefined;
    throw new ApiError(response.status, message, code);
  }

  return body as T;
}

/** Fetches the authenticated user's portfolio summary/valuation (spec 004 AC4-AC9). */
export function getPortfolioSummary(): Promise<PortfolioSummaryDto> {
  return apiFetch("/portfolio").then((res) => parseJsonOrThrow<PortfolioSummaryDto>(res));
}

/** Fetches the authenticated user's current holdings, sorted by market value (spec 004 AC12). */
export function getPortfolioHoldings(): Promise<HoldingDto[]> {
  return apiFetch("/portfolio/holdings").then((res) => parseJsonOrThrow<HoldingDto[]>(res));
}

/** Fetches one page of the authenticated user's transaction history (spec 004 AC16-AC21). */
export function getPortfolioTransactions(
  page = 1,
  limit = 20,
): Promise<PaginatedTransactionsDto> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/portfolio/transactions?${params.toString()}`).then((res) =>
    parseJsonOrThrow<PaginatedTransactionsDto>(res),
  );
}

export { ApiError };
