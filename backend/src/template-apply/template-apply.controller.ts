import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TemplateApplyService } from './template-apply.service';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateApplyController {
  constructor(private readonly templateApplyService: TemplateApplyService) { }

  @Post(':templateId/apply/:userId')
  applyTemplate(
    @Param('templateId') templateId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestActor,
  ) {
    return this.templateApplyService.applyTemplate(templateId, userId, user);
  }
}
