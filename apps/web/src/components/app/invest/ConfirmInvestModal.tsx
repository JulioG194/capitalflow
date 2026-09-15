"use client"; // calls POST /portfolio/invest and manages request/success/error state (spec 005 AC25-AC31)

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@capitalflow/shared-types";
import { investInPortfolio, ApiError } from "@/lib/portfolio/portfolio-client";

type Status = "idle" | "submitting" | "success" | "error";

type ErrorKind = "insufficient_funds" | "price_unavailable" | "rate_limited" | "generic";

interface ErrorState {
  kind: ErrorKind;
  retryAfterSeconds?: number;
}

interface ConfirmInvestModalProps {
  symbol: string;
  amount: string;
  onClose: () => void;
  /** Invoked once the invest call succeeds, so the parent can refetch its own portfolio data (AC27). */
  onInvested: () => void;
}

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  insufficient_funds: "No tienes suficiente efectivo simulado para esta inversión.",
  price_unavailable:
    "No hay un precio actualizado disponible para este símbolo en este momento. Inténtalo de nuevo en unos segundos.",
  rate_limited: "Hiciste demasiados intentos de inversión. Espera antes de volver a intentarlo.",
  generic: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

function classifyError(error: unknown): ErrorState {
  if (error instanceof ApiError) {
    if (error.code === "INSUFFICIENT_FUNDS") {
      return { kind: "insufficient_funds" };
    }
    if (error.code === "PRICE_UNAVAILABLE") {
      return { kind: "price_unavailable" };
    }
    if (error.status === 429) {
      return { kind: "rate_limited", retryAfterSeconds: error.retryAfterSeconds };
    }
  }
  return { kind: "generic" };
}

/**
 * AC25: "Confirmar inversión" modal — shows the selected symbol/amount and
 * simulated-investing copy. AC26: the confirm button is disabled/loading for
 * the request's duration. AC27-AC30: success/insufficient-funds/
 * price-unavailable/rate-limited outcomes each get their own message; the
 * error paths never clear the `symbol`/`amount` props (they're owned by the
 * parent `<InvestForm>`, never touched here). AC31: `mountedRef` guards every
 * `setState` after this component (or the whole page) unmounts while the
 * request is in flight — the request itself is never aborted, only this
 * component's reaction to its eventual resolution is skipped; reopening the
 * modal always renders a fresh instance with its own `handleConfirm`
 * closure, so an earlier in-flight request is never resubmitted or reused.
 */
export function ConfirmInvestModal({ symbol, amount, onClose, onInvested }: ConfirmInvestModalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const mountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  function handleConfirm() {
    setStatus("submitting");
    setErrorState(null);

    investInPortfolio({ symbol, amount })
      .then(() => {
        if (!mountedRef.current) return;
        setStatus("success");
        successTimerRef.current = setTimeout(() => {
          onInvested();
          onClose();
        }, 900);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return;
        setStatus("error");
        setErrorState(classifyError(error));
      });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-invest-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-lg">
        <h2 id="confirm-invest-heading" className="text-lg font-semibold text-ink">
          Confirmar inversión
        </h2>

        {status === "success" ? (
          <p className="mt-4 text-sm font-medium text-green-700">Inversión simulada realizada</p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-1 text-sm text-ink">
              <p>
                Símbolo: <span className="font-medium">{symbol}</span>
              </p>
              <p>
                Monto: <span className="font-medium">{formatMoney(amount)}</span>
              </p>
            </div>

            <p className="mt-3 text-xs text-amber-700">
              Esta inversión es simulada: no se mueve dinero real ni se garantiza ningún retorno.
            </p>

            {status === "error" && errorState ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {ERROR_MESSAGES[errorState.kind]}
                {errorState.kind === "rate_limited" && errorState.retryAfterSeconds !== undefined
                  ? ` Espera ${errorState.retryAfterSeconds} segundos antes de reintentar.`
                  : null}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-card border border-gray-200 px-3 py-1.5 text-sm font-medium text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={status === "submitting"}
                className="rounded-card bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
