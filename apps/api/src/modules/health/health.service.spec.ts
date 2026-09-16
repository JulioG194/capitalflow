import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  afterEach(() => {
    delete process.env.RENDER_GIT_COMMIT;
  });

  it('reports status "ok" and db "ok" when Postgres is reachable', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('ok');
    expect(result.service).toBe('api');
    expect(typeof result.uptime).toBe('number');
  });

  it('reports status "degraded" and db "error" when Postgres is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.db).toBe('error');
  });

  it('never leaks the underlying Prisma error', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).resolves.not.toThrow();
  });

  it('includes version from RENDER_GIT_COMMIT when present', async () => {
    process.env.RENDER_GIT_COMMIT = 'abc1234';
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.version).toBe('abc1234');
  });

  it('omits version when RENDER_GIT_COMMIT is not set', async () => {
    delete process.env.RENDER_GIT_COMMIT;
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.version).toBeUndefined();
  });
});
