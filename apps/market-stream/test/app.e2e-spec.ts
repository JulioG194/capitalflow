import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { HealthResponse } from '@capitalflow/shared-types';
import { HealthController } from './../src/health.controller';
import { QuoteCacheService } from './../src/redis/quote-cache.service';
import { FinnhubService } from './../src/finnhub/finnhub.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: QuoteCacheService,
          useValue: { isUnreachable: () => false },
        },
        { provide: FinnhubService, useValue: { isConnected: () => true } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    const body = response.body as HealthResponse;
    expect(body).toMatchObject({
      status: 'ok',
      service: 'market-stream',
      redis: 'ok',
      finnhub: 'connected',
    });
    expect(typeof body.uptime).toBe('number');
  });

  afterEach(async () => {
    await app.close();
  });
});
