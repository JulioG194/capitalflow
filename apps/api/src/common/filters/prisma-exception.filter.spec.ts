import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function makeHost(res: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = makeHost({ status, json });
    // The filter deliberately logs the raw error server-side (for
    // operator visibility) while returning a generic body to the client —
    // silence that expected log noise in test output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('AC2/AC32: maps a P2002 unique-constraint error on email to 409 EMAIL_ALREADY_EXISTS with no raw detail', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    const [body] = json.mock.calls[0] as [Record<string, unknown>];
    expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(JSON.stringify(body)).not.toContain('Unique constraint failed');
  });

  it('AC32: maps every other Prisma error class (e.g. a foreign-key violation on a non-register code path) to a generic 500 with no message/stack/SQL detail', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed on the field: `userId`',
      { code: 'P2003', clientVersion: 'test' },
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    const [body] = json.mock.calls[0] as [Record<string, unknown>];
    expect(body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(body)).not.toContain('Foreign key');
    expect(JSON.stringify(body)).not.toContain('userId');
  });

  it('AC32: a PrismaClientValidationError (e.g. a malformed query on any code path) never leaks its message', () => {
    const error = new Prisma.PrismaClientValidationError(
      'Invalid `prisma.user.update()` invocation: Argument `id` is missing.',
      { clientVersion: 'test' },
    );

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    const [body] = json.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(body)).not.toContain('prisma.user.update');
  });
});
