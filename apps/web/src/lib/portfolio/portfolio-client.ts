import type {
  HoldingDto,
  PaginatedTransactionsDto,
  PortfolioSummaryDto,
} from "@capitalflow/shared-types";
import { apiFetch } from "@/lib/auth/api-client";
import { ApiError } from "@/lib/auth/errors";

const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

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

/**
 * Same non-2xx handling as `parseJsonOrThrow`, plus threading a 429
 * response's `Retry-After` header into `ApiError.retryAfterSeconds` (spec
 * 005 AC30). The header must be read from `response` before `.json()` is
 * called — reading the body doesn't invalidate headers, but keeping the
 * header read first (and always attempted) makes the ordering dependency
 * explicit rather than incidental.
 */
async function parseInvestJsonOrThrow<T>(response: Response): Promise<T> {
  const retryAfterHeader = response.headers.get("Retry-After");
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = (body ?? {}) as ErrorBody;
    const message =
      typeof errorBody.message === "string" ? errorBody.message : GENERIC_ERROR_MESSAGE;
    const code = typeof errorBody.code === "string" ? errorBody.code : undefined;
    const retryAfterSeconds =
      response.status === 429 && retryAfterHeader !== null
        ? parseRetryAfterSeconds(retryAfterHeader)
        : undefined;
    throw new ApiError(response.status, message, code, retryAfterSeconds);
  }

  return body as T;
}

/**
 * `Retry-After` is permitted by spec to be either a delta-seconds integer
 * (what this API sends) or an HTTP-date — parsed defensively even though
 * only the delta-seconds form is expected here, so a malformed/unexpected
 * header value degrades to `undefined` rather than `NaN` leaking into UI copy.
 */
function parseRetryAfterSeconds(headerValue: string): number | undefined {
  const asInteger = Number.parseInt(headerValue, 10);
  if (Number.isFinite(asInteger) && asInteger >= 0) {
    return asInteger;
  }
  const asDate = Date.parse(headerValue);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  }
  return undefined;
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

/**
 * Commits simulated cash to a symbol (spec 005 AC1-AC17 backend contract).
 * Returns the caller's updated `PortfolioSummaryDto` on `201` so
 * `<ConfirmInvestModal>`/the invest page can refresh their display without a
 * second round trip. On a non-2xx response, throws `ApiError` — a 429
 * carries `retryAfterSeconds` when the server sent a `Retry-After` header
 * (AC30), and a 422/503/400 carries the domain `code` the modal switches on
 * (AC28/AC29).
 */
export function investInPortfolio(input: {
  symbol: string;
  amount: string;
}): Promise<PortfolioSummaryDto> {
  return apiFetch("/portfolio/invest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => parseInvestJsonOrThrow<PortfolioSummaryDto>(res));
}

export { ApiError };
