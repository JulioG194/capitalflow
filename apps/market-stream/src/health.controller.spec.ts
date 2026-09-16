import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { QuoteCacheService } from './redis/quote-cache.service';
import { FinnhubService } from './finnhub/finnhub.service';

describe('HealthController', () => {
  let controller: HealthController;
  let quoteCache: { isUnreachable: jest.Mock<boolean, []> };
  let finnhub: { isConnected: jest.Mock<boolean, []> };

  beforeEach(async () => {
    quoteCache = { isUnreachable: jest.fn<boolean, []>() };
    finnhub = { isConnected: jest.fn<boolean, []>() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: QuoteCacheService, useValue: quoteCache },
        { provide: FinnhubService, useValue: finnhub },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports "ok" when Redis is reachable and Finnhub is connected', () => {
    quoteCache.isUnreachable.mockReturnValue(false);
    finnhub.isConnected.mockReturnValue(true);

    const result = controller.health();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'market-stream',
      redis: 'ok',
      finnhub: 'connected',
    });
    expect(typeof result.uptime).toBe('number');
  });

  it('reports "degraded" when Redis is unreachable', () => {
    quoteCache.isUnreachable.mockReturnValue(true);
    finnhub.isConnected.mockReturnValue(true);

    const result = controller.health();

    expect(result.status).toBe('degraded');
    expect(result.redis).toBe('error');
  });

  it('does NOT flip status to "degraded" when only Finnhub is disconnected', () => {
    quoteCache.isUnreachable.mockReturnValue(false);
    finnhub.isConnected.mockReturnValue(false);

    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(result.finnhub).toBe('disconnected');
  });

  it('never returns an HTTP error status — /health always resolves to a plain object', () => {
    quoteCache.isUnreachable.mockReturnValue(true);
    finnhub.isConnected.mockReturnValue(false);

    expect(() => controller.health()).not.toThrow();
    expect(() => controller.root()).not.toThrow();
  });
});
