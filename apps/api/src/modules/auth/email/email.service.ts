import { Injectable, Logger } from '@nestjs/common';

export interface SendPasswordResetEmailParams {
  to: string;
  resetLink: string;
}

/**
 * AC34/AC35: abstract injection token for "send an email" — `AuthService`
 * depends only on this class, never on a concrete provider. Spec 006
 * (deployment) can swap in a real provider (SendGrid, Postmark, SES, ...)
 * by registering a different `useClass` for this token in `AuthModule`;
 * no change to `AuthService` or any controller is required.
 */
export abstract class EmailService {
  abstract sendPasswordResetEmail(
    params: SendPasswordResetEmailParams,
  ): Promise<void>;
}

/**
 * This spec's only concrete `EmailService` — logs the recipient and reset
 * link to the server log instead of dispatching a real email (spec 002 is
 * explicit that a real provider adapter is out of scope; see section 6).
 *
 * Spec 006 AC27: in production this is the ONLY way to retrieve a reset
 * link (there is no real email provider), so the log line format below is
 * a contract with `infra/DEPLOY.md`/the demo runbook — it must stay
 * exactly `[password-reset] user=<email> link=<url>`. Uses Nest's
 * `Logger` (not `console.*`) so a future structured-JSON logger
 * (`app.useLogger(...)`, spec 006 AC33) picks this line up too.
 */
@Injectable()
export class ConsoleEmailAdapter implements EmailService {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  sendPasswordResetEmail({
    to,
    resetLink,
  }: SendPasswordResetEmailParams): Promise<void> {
    this.logger.log(`[password-reset] user=${to} link=${resetLink}`);
    return Promise.resolve();
  }
}
