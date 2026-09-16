type PortfolioErrorStateProps = {
  message: string;
  onRetry: () => void;
};

/**
 * Shared error state with a retry action for `/app/portfolio`'s independent
 * data-fetching sections (AC24: a failed fetch must never leave a silently
 * blank section). Pure markup + a callback prop, no client-only APIs of its
 * own, so it's safe to import from any client component.
 */
export function PortfolioErrorState({ message, onRetry }: PortfolioErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-card border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}
