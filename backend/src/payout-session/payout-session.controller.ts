import { Controller, Post, Body, Param, Query, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePayoutSessionDto } from './dto/create-payout-session.dto';
import { PayoutSessionService } from './payout-session.service';
import { PayoutSessionStatus } from '@prisma/client';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Controller('payout-sessions')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class PayoutSessionController {
  constructor(private readonly payoutSessionService: PayoutSessionService) { }

  @Get()
  findAll(@Query('status') status?: PayoutSessionStatus) {
    return this.payoutSessionService.findAll(status);
  }

  @Post()
  create(@Body() dto: CreatePayoutSessionDto, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.create(dto, user.id);
  }

  @Post(':id/lock')
  lock(@Param('id') id: string, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.lock(id, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.complete(id, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payoutSessionService.findOne(id);
  }
}