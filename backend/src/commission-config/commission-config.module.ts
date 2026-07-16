import { Module } from '@nestjs/common';
import { CommissionConfigController } from './commission-config.controller';
import { CommissionConfigService } from './commission-config.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CommissionConfigController],
  providers: [CommissionConfigService],
  exports: [CommissionConfigService],
})
export class CommissionConfigModule {}
