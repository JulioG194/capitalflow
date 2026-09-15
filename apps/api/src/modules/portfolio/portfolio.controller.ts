import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  investSchema,
  transactionsQuerySchema,
  type HoldingDto,
  type InvestInput,
  type PaginatedTransactionsDto,
  type PortfolioSummaryDto,
  type TransactionsQuery,
} from '@capitalflow/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AccessTokenGuard,
  type RequestWithUser,
} from '../auth/guards/access-token.guard';
import { InvestThrottlerGuard } from './guards/invest-throttler.guard';
import { PortfolioService } from './portfolio.service';

/** AC11 (spec 004) / AC13 (spec 005): every route here requires a valid access token. */
@Controller('portfolio')
@UseGuards(AccessTokenGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getSummary(@Req() req: RequestWithUser): Promise<PortfolioSummaryDto> {
    return this.portfolioService.getSummary(req.user.sub);
  }

  @Get('holdings')
  getHoldings(@Req() req: RequestWithUser): Promise<HoldingDto[]> {
    return this.portfolioService.getHoldings(req.user.sub);
  }

  @Get('transactions')
  getTransactions(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(transactionsQuerySchema))
    query: TransactionsQuery,
  ): Promise<PaginatedTransactionsDto> {
    return this.portfolioService.getTransactions(
      req.user.sub,
      query.page,
      query.limit,
    );
  }

  /**
   * Spec 005 AC1-AC17: commits simulated cash to a symbol. Guarded by the
   * class-level `AccessTokenGuard` (AC13) plus `InvestThrottlerGuard`
   * (AC14/AC15, 30 requests/hour/user by default) — the throttler guard
   * runs after `AccessTokenGuard` since class-level guards execute before
   * method-level ones, so `req.user` is already populated when its tracker
   * reads `req.user.sub`.
   */
  @Post('invest')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(InvestThrottlerGuard)
  invest(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(investSchema)) body: InvestInput,
  ): Promise<PortfolioSummaryDto> {
    return this.portfolioService.invest(req.user.sub, body.symbol, body.amount);
  }
}
