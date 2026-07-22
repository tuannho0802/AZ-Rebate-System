import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RebateManagementService } from './rebate-management.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PatchBranchAssetDto } from './dto/patch-branch-asset.dto';

interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@ApiTags('Rebate Management')
@Controller('rebate-management')
@UseGuards(JwtAuthGuard)
export class RebateManagementController {
  constructor(private readonly rebateManagementService: RebateManagementService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Overview all root branches',
    description: 'Liệt kê toàn bộ MIB gốc và trạng thái rebate-management theo active asset',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Danh sách overview của các MIB gốc' })
  @ApiForbiddenResponse({ description: 'Chỉ Admin được phép truy cập' })
  getOverview(@CurrentUser() actor: RequestActor) {
    return this.rebateManagementService.getOverview(actor);
  }

  @Get(':rootUserId/asset/:assetId')
  @ApiOperation({
    summary: 'Get rebate tree by branch and asset',
    description: 'Trả về cây nhánh thật của một MIB gốc theo một asset, có cumulative per-path',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'rootUserId', description: 'ID MIB gốc' })
  @ApiParam({ name: 'assetId', description: 'ID asset' })
  @ApiOkResponse({ description: 'Chi tiết cây rebate-management theo nhánh + asset' })
  @ApiForbiddenResponse({ description: 'Chỉ Admin được phép truy cập' })
  @ApiBadRequestResponse({ description: 'Asset chưa có Cap Max hoặc rootUserId không phải MIB gốc' })
  getBranchAsset(
    @Param('rootUserId') rootUserId: string,
    @Param('assetId') assetId: string,
    @CurrentUser() actor: RequestActor,
  ): Promise<unknown> {
    return this.rebateManagementService.getBranchAsset(rootUserId, assetId, actor);
  }

  @Patch(':rootUserId/asset/:assetId')
  @ApiOperation({
    summary: 'Patch rebate tree by branch and asset',
    description: 'Cập nhật own rebate/markup của nhiều node trong nhánh, validate theo từng path',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'rootUserId', description: 'ID MIB gốc' })
  @ApiParam({ name: 'assetId', description: 'ID asset' })
  @ApiOkResponse({ description: 'Cập nhật thành công' })
  @ApiForbiddenResponse({ description: 'Chỉ Admin được phép truy cập' })
  @ApiBadRequestResponse({ description: 'Có path lệch Cap Max hoặc dữ liệu cập nhật không hợp lệ' })
  patchBranchAsset(
    @Param('rootUserId') rootUserId: string,
    @Param('assetId') assetId: string,
    @Body() dto: PatchBranchAssetDto,
    @CurrentUser() actor: RequestActor,
  ): Promise<unknown> {
    return this.rebateManagementService.patchBranchAsset(rootUserId, assetId, dto, actor);
  }
}
