import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TemplateApplyService } from './template-apply.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@ApiTags('Template Apply')
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateApplyController {
  constructor(private readonly templateApplyService: TemplateApplyService) { }

  @Post(':templateId/apply/:userId')
  @ApiOperation({ summary: 'Apply template to user', description: 'Áp dụng template hoa hồng cho 1 user (tạo hoặc cập nhật config cho từng asset)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'templateId', description: 'ID template' })
  @ApiParam({ name: 'userId', description: 'ID user được áp dụng' })
  @ApiCreatedResponse({ description: 'Template được áp dụng' })
  @ApiForbiddenResponse({ description: 'Không phải Admin hoặc không phải cha trực tiếp' })
  @ApiNotFoundResponse({ description: 'Template hoặc user không tồn tại' })
  @ApiBadRequestResponse({ description: 'User đã có config cho một số asset' })
  applyTemplate(
    @Param('templateId') templateId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestActor,
  ) {
    return this.templateApplyService.applyTemplate(templateId, userId, user);
  }
}
