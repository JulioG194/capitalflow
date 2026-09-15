import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 005 AC5/AC6: thrown when the caller's `Portfolio.cashBalance` is
 * strictly less than the requested invest `amount`. The check itself is
 * an atomic conditional DB update (never a separate read-then-write), so
 * this exception is also what a losing request in a concurrency race
 * (AC6) receives.
 */
export class InsufficientFundsException extends DomainException {
  constructor() {
    super(
      'INSUFFICIENT_FUNDS',
      'Insufficient simulated cash balance for this investment.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
