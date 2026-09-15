import { Logger } from '@nestjs/common';
import { ConsoleEmailAdapter } from './email.service';

describe('ConsoleEmailAdapter', () => {
  it('AC34: logs the recipient, subject, and reset link instead of sending a real email', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const adapter = new ConsoleEmailAdapter();

    await adapter.sendPasswordResetEmail({
      to: 'user@example.com',
      resetLink: 'http://localhost:3000/reset-password?token=abc123',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain('user@example.com');
    expect(message).toContain('Reset your CapitalFlow password');
    expect(message).toContain(
      'http://localhost:3000/reset-password?token=abc123',
    );

    logSpy.mockRestore();
  });
});
