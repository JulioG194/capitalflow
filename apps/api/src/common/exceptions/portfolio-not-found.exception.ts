import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 004 AC10: an authenticated user with no `Portfolio` row (a
 * data-integrity edge case — every account created after the registration
 * hook shipped always has one).
 */
export class PortfolioNotFoundException extends DomainException {
  constructor() {
    super(
      'PORTFOLIO_NOT_FOUND',
      'No portfolio exists for this account.',
      HttpStatus.NOT_FOUND,
    );
  }
}
