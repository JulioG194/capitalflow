import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '@capitalflow/shared-types';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let check: jest.Mock<Promise<HealthResponse>, []>;
  let status: jest.Mock<Response, [number]>;

  beforeEach(async () => {
    check = jest.fn<Promise<HealthResponse>, []>();
    status = jest.fn<Response, [number]>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();

    controller = module.get(HealthController);
  });

  const asResponse = (): Response => ({ status }) as unknown as Response;

  it('responds 200 when status is "ok"', async () => {
    const body: HealthResponse = {
      status: 'ok',
      uptime: 12.3,
      service: 'api',
      db: 'ok',
    };
    check.mockResolvedValue(body);

    const result = await controller.check(asResponse());

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(result).toEqual(body);
  });

  it('responds 503 when status is "degraded"', async () => {
    const body: HealthResponse = {
      status: 'degraded',
      uptime: 12.3,
      service: 'api',
      db: 'error',
    };
    check.mockResolvedValue(body);

    const result = await controller.check(asResponse());

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result).toEqual(body);
  });
});
