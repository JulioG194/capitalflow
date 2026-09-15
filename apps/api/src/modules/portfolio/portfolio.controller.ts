import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { PortfolioSummaryDto } from '@capitalflow/shared-types';
import {
  AccessTokenGuard,
  type RequestWithUser,
} from '../auth/guards/access-token.guard';
import { PortfolioService } from './portfolio.service';

/** AC11: every route here requires a valid access token. */
@Controller('portfolio')
@UseGuards(AccessTokenGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getSummary(@Req() req: RequestWithUser): Promise<PortfolioSummaryDto> {
    return this.portfolioService.getSummary(req.user.sub);
  }
}
