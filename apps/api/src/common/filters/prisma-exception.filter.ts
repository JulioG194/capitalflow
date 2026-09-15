import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client.js';

/**
 * Catches every Prisma error class and maps it to a generic domain error
 * response, so raw Prisma error text/stack/SQL never reaches a client
 * (spec 002 AC32, edge case "concurrent registration"). A unique-constraint
 * violation (P2002) on `email` is mapped to the same 409 EMAIL_ALREADY_EXISTS
 * shape used by the service-level pre-check (AC2), which resolves the
 * registration race described in section 5 of the spec.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown Prisma error',
      exception instanceof Error ? exception.stack : undefined,
    );

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      const target = Array.isArray(exception.meta?.target)
        ? (exception.meta.target as string[])
        : [];

      if (target.includes('email')) {
        response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists.',
        });
        return;
      }

      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'A record with these details already exists.',
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
}
