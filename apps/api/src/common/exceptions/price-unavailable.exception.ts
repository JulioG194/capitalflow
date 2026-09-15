import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Spec 005 AC7/design decision 1: no fresh cached price exists at
 * `market:quote:<symbol>` (missing key, expired TTL, or Redis unreachable
 * are all treated identically). Unlike spec 004's read-only valuation,
 * `POST /portfolio/invest` never falls back to a holding's `averagePrice`
 * — doing so here would fabricate the price a purchase actually executed
 * at.
 */
export class PriceUnavailableException extends DomainException {
  constructor() {
    super(
      'PRICE_UNAVAILABLE',
      'No fresh market price is available for this symbol right now.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
