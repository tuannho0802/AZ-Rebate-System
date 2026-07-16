import { Controller, Post, Body, Patch, Param, Query, UseGuards, Get, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { CommissionConfigService } from './commission-config.service';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Controller('commission-configs')
@UseGuards(JwtAuthGuard)
export class CommissionConfigController {
  constructor(private readonly commissionConfigService: CommissionConfigService) { }

  @Post()
  upsert(@Body() dto: UpsertConfigDto, @CurrentUser() user: RequestActor) {
    return this.commissionConfigService.upsert(dto, user);
  }

  @Patch(':userId/:assetId')
  update(
    @Param('userId') userId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: RequestActor,
  ) {
    return this.commissionConfigService.update(userId, assetId, dto, user);
  }

  /**
   * ADMIN-ONLY: xem toan bo cay hoa hong (MIB -> lvN) cho 1 asset.
   * GET /commission-configs/tree/:userId?assetId=xxx
   */
  @Get('tree/:userId')
  getTree(
    @Param('userId') userId: string,
    @Query('assetId') assetId: string,
    @CurrentUser() user: RequestActor,
  ) {
    if (!assetId) throw new BadRequestException('assetId query param is required');
    return this.commissionConfigService.getFullTree(userId, assetId, user);
  }

  /**
   * Xem 1 cap: chinh minh + cac con TRUC TIEP. Actor phai la chinh userId nay
   * hoac Admin.
   * GET /commission-configs/children/:userId?assetId=xxx
   */
  @Get('children/:userId')
  getChildren(
    @Param('userId') userId: string,
    @Query('assetId') assetId: string,
    @CurrentUser() user: RequestActor,
  ) {
    if (!assetId) throw new BadRequestException('assetId query param is required');
    return this.commissionConfigService.getDirectChildren(userId, assetId, user);
  }
}