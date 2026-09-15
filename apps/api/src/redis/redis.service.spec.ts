import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvConfig } from '../config/env.schema';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('RedisService', () => {
  let client: { get: jest.Mock; on: jest.Mock; quit: jest.Mock };
  let service: RedisService;

  beforeEach(() => {
    client = {
      get: jest.fn(),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    (Redis as unknown as jest.Mock).mockImplementation(() => client);

    const config = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as unknown as ConfigService<EnvConfig, true>;
    service = new RedisService(config);
    service.onModuleInit();
  });

  it('registers an error handler so a connection error never crashes the process', () => {
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
    // Simulating an emitted error must not throw.
    const [, errorHandler] = client.on.mock.calls[0] as [string, () => void];
    expect(() => errorHandler()).not.toThrow();
  });

  it('returns the cached value on a hit', async () => {
    client.get.mockResolvedValue('{"price":"200.00"}');

    await expect(service.get('market:quote:AAPL')).resolves.toBe(
      '{"price":"200.00"}',
    );
  });

  it('returns null on a cache miss', async () => {
    client.get.mockResolvedValue(null);

    await expect(service.get('market:quote:AAPL')).resolves.toBeNull();
  });

  it('AC13/AC14: returns null instead of throwing when the client rejects (Redis unreachable)', async () => {
    client.get.mockRejectedValue(new Error('connection refused'));

    await expect(service.get('market:quote:AAPL')).resolves.toBeNull();
  });

  it('quits the client on module destroy', async () => {
    await service.onModuleDestroy();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
