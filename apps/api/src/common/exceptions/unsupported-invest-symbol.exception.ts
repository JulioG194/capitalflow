import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 005 AC2: a `symbol` outside the investable set
 * (`@capitalflow/shared-types`'s `INVESTABLE_SYMBOLS`). In the live HTTP
 * path this is normally caught earlier by `investSchema`'s `z.enum(...)`
 * inside the request-body `ZodValidationPipe` (a generic 400 validation
 * error, since AC2/AC3 collapse into the same zod check once the schema
 * enumerates the exact allowed set) — this exception exists as an explicit,
 * directly-testable domain error for any caller of
 * `PortfolioService.invest` that bypasses the HTTP pipe (unit tests, or a
 * future internal caller), and as defense-in-depth should that pipe-level
 * check ever be loosened.
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
