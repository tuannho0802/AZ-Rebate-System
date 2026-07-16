import { Module } from '@nestjs/common';
import { PayoutSessionController } from './payout-session.controller';
import { PayoutSessionService } from './payout-session.service';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [AuditModule, LedgerModule],
  controllers: [PayoutSessionController],
  providers: [PayoutSessionService],
})
export class PayoutSessionModule {}
