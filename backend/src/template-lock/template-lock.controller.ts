import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TemplateLockService } from './template-lock.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('Template Lock')
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateLockController {
  constructor(private readonly templateLockService: TemplateLockService) {}

  @Post(':templateId/lock/:userId')
  @ApiOperation({ summary: 'Lock template for user', description: 'Khóa template không cho user sử dụng (Chỉ Admin hoặc cha trực tiếp)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'templateId', description: 'ID template' })
  @ApiParam({ name: 'userId', description: 'ID user bị khóa' })
  lock(
    @Param('templateId') templateId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateLockService.lockTemplate(templateId, userId, user);
  }

  @Post(':templateId/unlock/:userId')
  @ApiOperation({ summary: 'Unlock template for user', description: 'Mở khóa template cho user sử dụng (Chỉ Admin hoặc cha trực tiếp)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'templateId', description: 'ID template' })
  @ApiParam({ name: 'userId', description: 'ID user được mở khóa' })
  unlock(
    @Param('templateId') templateId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateLockService.unlockTemplate(templateId, userId, user);
  }

  @Get('visible')
  @ApiOperation({ summary: 'List visible templates', description: 'Lấy danh sách các template được phép xem/sử dụng của actor' })
  @ApiBearerAuth('access-token')
  listVisible(@CurrentUser() user: any) {
    return this.templateLockService.listVisibleTemplates(user);
  }

  @Get('locks/:userId')
  @ApiOperation({ summary: 'List lock status for user', description: 'Lấy trạng thái khóa của tất cả template (cùng level) cho user con trực tiếp' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'userId', description: 'ID user con trực tiếp cần kiểm tra' })
  listLockStatus(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateLockService.listLockStatusForUser(userId, user);
  }
}
