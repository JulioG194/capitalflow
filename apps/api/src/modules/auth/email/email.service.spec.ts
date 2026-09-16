import { Logger } from '@nestjs/common';
import { ConsoleEmailAdapter } from './email.service';

describe('ConsoleEmailAdapter', () => {
  it('AC34/spec 006 AC27: logs the recipient and reset link via Nest Logger in the exact `[password-reset] user=<email> link=<url>` format', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const adapter = new ConsoleEmailAdapter();

    await adapter.sendPasswordResetEmail({
      to: 'user@example.com',
      resetLink: 'http://localhost:3000/reset-password?token=abc123',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toBe(
      '[password-reset] user=user@example.com link=http://localhost:3000/reset-password?token=abc123',
    );

    logSpy.mockRestore();
  });
});
