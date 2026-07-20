import { Controller, Post, Body, Param, Query, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePayoutSessionDto } from './dto/create-payout-session.dto';
import { PayoutSessionService } from './payout-session.service';
import { PayoutSessionStatus } from '@prisma/client';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiOkResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@ApiTags('Payout Sessions')
@Controller('payout-sessions')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class PayoutSessionController {
  constructor(private readonly payoutSessionService: PayoutSessionService) { }

  @Get()
  @ApiOperation({ summary: 'List payout sessions', description: 'Lấy danh sách payout sessions (filter theo status)' })
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'status', required: false, enum: PayoutSessionStatus, description: 'Lọc theo status (DRAFT, LOCKED, COMPLETED)' })
  @ApiOkResponse({ description: 'Danh sách payout sessions' })
  findAll(@Query('status') status?: PayoutSessionStatus) {
    return this.payoutSessionService.findAll(status);
  }

  @Post()
  @ApiOperation({ summary: 'Create payout session', description: 'Tạo payout session mới (DRAFT)' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Payout session được tạo' })
  @ApiForbiddenResponse({ description: 'Không phải Admin' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  @ApiBody({ type: CreatePayoutSessionDto })
  create(@Body() dto: CreatePayoutSessionDto, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.create(dto, user.id);
  }

  @Post(':id/lock')
  @ApiOperation({ summary: 'Lock payout session', description: 'Chuyển session từ DRAFT sang LOCKED (không sửa được)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID payout session' })
  @ApiOkResponse({ description: 'Session được khóa' })
  @ApiNotFoundResponse({ description: 'Session không tồn tại' })
  @ApiBadRequestResponse({ description: 'Session không ở trạng thái DRAFT' })
  lock(@Param('id') id: string, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.lock(id, user.id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete payout session', description: 'Chuyển session từ LOCKED sang COMPLETED (tính hoa hồng)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID payout session' })
  @ApiOkResponse({ description: 'Session được hoàn tất' })
  @ApiNotFoundResponse({ description: 'Session không tồn tại' })
  @ApiBadRequestResponse({ description: 'Session không ở trạng thái LOCKED' })
  complete(@Param('id') id: string, @CurrentUser() user: RequestActor) {
    return this.payoutSessionService.complete(id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payout session detail', description: 'Xem chi tiết payout session kèm ledger entries' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID payout session' })
  @ApiOkResponse({ description: 'Chi tiết payout session' })
  @ApiNotFoundResponse({ description: 'Session không tồn tại' })
  findOne(@Param('id') id: string) {
    return this.payoutSessionService.findOne(id);
  }
}
