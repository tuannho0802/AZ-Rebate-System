import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { TemplateLevelConfigService } from './template-level-config.service';
import { UpsertTemplateLevelConfigDto } from './dto/upsert-template-level-config.dto';

@ApiTags('Template Level Config')
@Controller('templates')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class TemplateLevelConfigController {
  constructor(private readonly templateLevelConfigService: TemplateLevelConfigService) {}

  @Post(':id/level-configs')
  @ApiOperation({
    summary: 'Create or update template level configs',
    description: 'Thêm/cập nhật nhiều TemplateLevelConfig cho template type=LEVEL',
  })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID template' })
  @ApiCreatedResponse({ description: 'Lưu level configs thành công' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  @ApiNotFoundResponse({ description: 'Template hoặc asset không tồn tại' })
  @ApiBadRequestResponse({ description: 'Template sai type hoặc dữ liệu level config/cap max không hợp lệ' })
  upsert(@Param('id') templateId: string, @Body() dto: UpsertTemplateLevelConfigDto) {
    return this.templateLevelConfigService.upsert(templateId, dto);
  }
}
