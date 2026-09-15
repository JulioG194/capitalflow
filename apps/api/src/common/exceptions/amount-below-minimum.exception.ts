import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 005 AC4/design decision 4: `amount` is structurally well-formed
 * (already passed `investAmountSchema`) but below the pinned business
 * minimum of `"1.00"`.
 */
export class AmountBelowMinimumException extends DomainException {
  constructor() {
    super(
      'AMOUNT_BELOW_MINIMUM',
      'The investment amount is below the minimum allowed.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
