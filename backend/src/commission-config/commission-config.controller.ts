import { Controller, Post, Body, Patch, Param, Query, UseGuards, Get, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { CommissionConfigService } from './commission-config.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiOkResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiConflictResponse } from '@nestjs/swagger';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@ApiTags('Commission Config')
@Controller('commission-configs')
@UseGuards(JwtAuthGuard)
export class CommissionConfigController {
  constructor(private readonly commissionConfigService: CommissionConfigService) { }

  @Post()
  @ApiOperation({ summary: 'Upsert commission config', description: 'Tạo hoặc cập nhật config hoa hồng cho user-asset pair' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Config được tạo/cập nhật' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ, vượt trần cha' })
  @ApiForbiddenResponse({ description: 'Không phải MIB tự sửa config gốc hoặc IB không có quyền' })
  @ApiConflictResponse({ description: 'Version conflict — config đã bị sửa từ lần đọc' })
  @ApiBody({ type: UpsertConfigDto })
  upsert(@Body() dto: UpsertConfigDto, @CurrentUser() user: RequestActor) {
    return this.commissionConfigService.upsert(dto, user);
  }

  @Patch(':userId/:assetId')
  @ApiOperation({ summary: 'Update commission config', description: 'Cập nhật rebateUnit/markupPips với version check (optimistic lock)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'userId', description: 'ID user' })
  @ApiParam({ name: 'assetId', description: 'ID asset' })
  @ApiOkResponse({ description: 'Config được cập nhật' })
  @ApiNotFoundResponse({ description: 'User hoặc asset không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền sửa (tự sửa, không phải cha)' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  @ApiConflictResponse({ description: 'Version conflict' })
  @ApiBody({ type: UpdateConfigDto })
  update(
    @Param('userId') userId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: RequestActor,
  ) {
    return this.commissionConfigService.update(userId, assetId, dto, user);
  }

  @Get('tree/:userId')
  @ApiOperation({ summary: 'Get commission tree', description: 'ADMIN-ONLY: xem toàn bộ cây hoa hồng của 1 MIB cho 1 asset' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'userId', description: 'ID user root của cây' })
  @ApiQuery({ name: 'assetId', description: 'ID asset (bắt buộc)' })
  @ApiOkResponse({ description: 'Cây hoa hồng đầy đủ' })
  @ApiBadRequestResponse({ description: 'Thiếu assetId query param' })
  @ApiForbiddenResponse({ description: 'Không phải Admin hoặc không trong cây của mình' })
  getTree(
    @Param('userId') userId: string,
    @Query('assetId') assetId: string,
    @CurrentUser() user: RequestActor,
  ) {
    if (!assetId) throw new BadRequestException('assetId query param is required');
    return this.commissionConfigService.getFullTree(userId, assetId, user);
  }

  @Get('children/:userId')
  @ApiOperation({ summary: 'Get direct children configs', description: 'Xem config của chính mình + con trực tiếp cho 1 asset' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'userId', description: 'ID user root' })
  @ApiQuery({ name: 'assetId', description: 'ID asset (bắt buộc)' })
  @ApiOkResponse({ description: 'Danh sách config: mình + con trực tiếp' })
  @ApiBadRequestResponse({ description: 'Thiếu assetId query param' })
  @ApiForbiddenResponse({ description: 'Không phải Admin hoặc không phải chính userId' })
  getChildren(
    @Param('userId') userId: string,
    @Query('assetId') assetId: string,
    @CurrentUser() user: RequestActor,
  ) {
    if (!assetId) throw new BadRequestException('assetId query param is required');
    return this.commissionConfigService.getDirectChildren(userId, assetId, user);
  }
}
