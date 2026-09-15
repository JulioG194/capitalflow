import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { PaginatedTransactionsDto, TransactionDto } from "@capitalflow/shared-types";
import { TransactionHistory } from "@/components/app/portfolio/TransactionHistory";
import { getPortfolioTransactions } from "@/lib/portfolio/portfolio-client";

vi.mock("@/lib/portfolio/portfolio-client", () => ({
  getPortfolioTransactions: vi.fn(),
}));

function transaction(overrides: Partial<TransactionDto> & Pick<TransactionDto, "id">): TransactionDto {
  return {
    type: "deposit",
    symbol: null,
    quantity: null,
    price: null,
    amount: "10000.00",
    status: "completed",
    createdAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function page(overrides: Partial<PaginatedTransactionsDto> = {}): PaginatedTransactionsDto {
  return {
    items: [transaction({ id: "1" })],
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    ...overrides,
  };
}

describe("TransactionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC23: shows a loading state before the response arrives", () => {
    vi.mocked(getPortfolioTransactions).mockReturnValue(new Promise(() => {}));

    render(<TransactionHistory />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC24: shows an error state with a retry action on failure", async () => {
    vi.mocked(getPortfolioTransactions).mockRejectedValueOnce(new Error("network error"));

    render(<TransactionHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar tu historial de transacciones.",
    );

    vi.mocked(getPortfolioTransactions).mockResolvedValueOnce(page());
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(getPortfolioTransactions).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Depósito")).toBeInTheDocument();
  });

  it("AC28: renders one row per transaction with '—' for null symbol/quantity and formatted amount/date", async () => {
    vi.mocked(getPortfolioTransactions).mockResolvedValue(page());

    render(<TransactionHistory />);

    expect(await screen.findByText("Depósito")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("$10,000.00")).toBeInTheDocument();
    expect(screen.getByText("Completada")).toBeInTheDocument();
    expect(getPortfolioTransactions).toHaveBeenCalledWith(1, 20);
  });

  it("AC29: advancing to the next page re-fetches with the incremented page and replaces rows", async () => {
    vi.mocked(getPortfolioTransactions).mockResolvedValueOnce(
      page({
        items: [transaction({ id: "1", type: "buy", symbol: "AAPL", quantity: "5" })],
        page: 1,
        totalPages: 2,
      }),
    );
    render(<TransactionHistory />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();

    vi.mocked(getPortfolioTransactions).mockResolvedValueOnce(
      page({
        items: [transaction({ id: "2", type: "sell", symbol: "TSLA", quantity: "2" })],
        page: 2,
        totalPages: 2,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(getPortfolioTransactions).toHaveBeenCalledWith(2, 20);
    });
    expect(await screen.findByText("TSLA")).toBeInTheDocument();
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no transactions", async () => {
    vi.mocked(getPortfolioTransactions).mockResolvedValue(
      page({ items: [], total: 0, totalPages: 0 }),
    );

    render(<TransactionHistory />);

    expect(await screen.findByText("Todavía no tienes transacciones.")).toBeInTheDocument();
  });
});
