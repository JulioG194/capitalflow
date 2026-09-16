import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { RendimientoCalculator } from "@/components/app/invest/RendimientoCalculator";

const CALCULATOR_SOURCE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "components",
  "app",
  "invest",
  "RendimientoCalculator.tsx",
);

describe("RendimientoCalculator", () => {
  const originalFetch = globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("AC18: recomputes the estimate whenever amount, plan, or months changes", () => {
    render(<RendimientoCalculator />);

    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "12" } });

    // moderado (7%/yr) monthlyRate = 0.07/12; over 12 months on $1000
    // estimatedReturn = 1000 * ((1 + 0.07/12) ** 12 - 1) = 72.29 (rounded)
    expect(screen.getByText("$72.29")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "agresivo" } });
    // agresivo (11%/yr) over 12 months on $1000 -> different figure
    expect(screen.queryByText("$72.29")).not.toBeInTheDocument();
  });

  it("AC19: labels the result as an illustrative, non-guaranteed estimate", () => {
    render(<RendimientoCalculator />);

    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "12" } });

    expect(screen.getByText(/Illustrative estimate, not guaranteed/)).toBeInTheDocument();
  });

  it("AC20: an empty/zero/negative amount shows a validation message and no numeric result", () => {
    render(<RendimientoCalculator />);

    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent("simulated amount greater than $0");
    expect(screen.queryByText(/Illustrative estimate/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "-5" } });
    expect(screen.getByRole("alert")).toHaveTextContent("simulated amount greater than $0");
  });

  it("AC20: an empty/zero/>60 months shows a validation message and no numeric result", () => {
    render(<RendimientoCalculator />);

    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "1000" } });

    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent("months between 1 and 60");

    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "61" } });
    expect(screen.getByRole("alert")).toHaveTextContent("months between 1 and 60");

    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("months between 1 and 60");
  });

  it("AC21: never issues a network request as inputs change", () => {
    render(<RendimientoCalculator />);

    fireEvent.change(screen.getByLabelText("Simulated amount"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "agresivo" } });
    fireEvent.change(screen.getByLabelText("Term (months)"), { target: { value: "24" } });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AC21 (static): the component's own source calls no network/invest function", () => {
    const source = readFileSync(CALCULATOR_SOURCE_PATH, "utf-8");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("apiFetch(");
    expect(source).not.toContain("investInPortfolio(");
  });

  it("AC22: the plan selector shows all three plans with their pinned annual rate", () => {
    render(<RendimientoCalculator />);

    const select = screen.getByLabelText("Plan") as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((option) => option.textContent);

    expect(optionTexts).toEqual([
      "Conservative — 4% estimated annual",
      "Moderate — 7% estimated annual",
      "Aggressive — 11% estimated annual",
    ]);
  });
});
