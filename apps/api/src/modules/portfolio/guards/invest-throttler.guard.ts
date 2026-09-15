import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestWithUser } from '../../auth/guards/access-token.guard';

/**
 * Spec 005 design decision 3: `POST /portfolio/invest` is always called by
 * an authenticated user, so the rate limit is keyed by `req.user.sub`
 * rather than IP (unlike spec 002's necessarily IP-keyed login throttle,
 * where the caller isn't authenticated yet). This guard must run AFTER
 * `AccessTokenGuard` has populated `req.user` — enforced by applying it as
 * a method-level guard on a controller that already has `AccessTokenGuard`
 * at the class level (class-level guards run before method-level ones).
 */
@Injectable()
export class InvestThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithUser): Promise<string> {
    return Promise.resolve(req.user.sub);
  }
}
