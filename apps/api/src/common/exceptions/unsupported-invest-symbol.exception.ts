import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 005 AC2: a `symbol` outside the investable set
 * (`@capitalflow/shared-types`'s `INVESTABLE_SYMBOLS`). `investSchema`'s
 * `symbol` field is deliberately format-only (any non-empty string) — a
 * `z.enum(...)` there would swallow this into AC3's generic zod
 * validation-error shape before `PortfolioService.invest` ever runs.
 * `PortfolioService.invest` is therefore the sole place that checks
 * membership, throwing this exception for a well-formed-but-unsupported
 * symbol so AC2 gets its own distinct `400 UNSUPPORTED_SYMBOL` response.
 */
export class UnsupportedInvestSymbolException extends DomainException {
  constructor() {
    super(
      'UNSUPPORTED_SYMBOL',
      'This symbol is not available for simulated investing.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
