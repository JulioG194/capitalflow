import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodError, ZodType } from 'zod';

interface FieldError {
  field: string;
  message: string;
}

/**
 * Generic request-body validation pipe backed by a shared zod schema (the
 * single source of truth for shape and complexity rules, imported from
 * `@capitalflow/shared-types`). Applied per-route, e.g.
 * `@Body(new ZodValidationPipe(registerBodySchema)) body: RegisterDto`,
 * instead of hand-writing parallel `class-validator` decorators on the DTO
 * (AC43/AC44 — one rule set, defined once).
 */
export class ZodValidationPipe<Output> implements PipeTransform<
  unknown,
  Output
> {
  constructor(private readonly schema: ZodType<Output>) {}

  transform(value: unknown): Output {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: this.formatIssues(result.error),
      });
    }

    return result.data;
  }

  private formatIssues(error: ZodError): FieldError[] {
    return error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
  }
}
