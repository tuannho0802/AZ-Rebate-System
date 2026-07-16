import { Module } from '@nestjs/common';
import { TemplateApplyController } from './template-apply.controller';
import { TemplateApplyService } from './template-apply.service';
import { CommissionConfigModule } from '../commission-config/commission-config.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [CommissionConfigModule, AuditModule, PrismaModule],
  controllers: [TemplateApplyController],
  providers: [TemplateApplyService],
})
export class TemplateApplyModule {}
