import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for all domain-level errors. Extending `HttpException` lets
 * Nest's default handling produce a clean HTTP response without leaking
 * internal details (e.g. Prisma error text/stack) to the client — every
 * domain exception carries its own stable `code` for API consumers.
 */
export abstract class DomainException extends HttpException {
  protected constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ statusCode: status, code, message }, status);
  }
}
