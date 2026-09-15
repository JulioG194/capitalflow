import { BadRequestException } from '@nestjs/common';
import { registerSchema } from '@capitalflow/shared-types';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerSchema.strict());

  const validBody = {
    email: 'user@example.com',
    password: 'correcthorse1',
    name: 'Ada Lovelace',
  };

  it('passes through and parses a valid payload', () => {
    expect(pipe.transform(validBody)).toEqual(validBody);
  });

  it('AC3: rejects a password shorter than 10 characters', () => {
    expect(() => pipe.transform({ ...validBody, password: 'short1a' })).toThrow(
      BadRequestException,
    );
  });

  it('AC3: rejects a password missing a letter', () => {
    expect(() =>
      pipe.transform({ ...validBody, password: '1234567890' }),
    ).toThrow(BadRequestException);
  });

  it('AC3: rejects a password missing a number', () => {
    expect(() =>
      pipe.transform({ ...validBody, password: 'nonumbershere' }),
    ).toThrow(BadRequestException);
  });

  it('AC5: rejects unexpected/extra fields', () => {
    expect(() => pipe.transform({ ...validBody, role: 'admin' })).toThrow(
      BadRequestException,
    );
  });
});
