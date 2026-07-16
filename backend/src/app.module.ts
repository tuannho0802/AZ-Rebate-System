import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CommissionConfigModule } from './commission-config/commission-config.module';
import { PayoutSessionModule } from './payout-session/payout-session.module';
import { LedgerModule } from './ledger/ledger.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TemplateApplyModule } from './template-apply/template-apply.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule, 
    AdminModule, 
    UsersModule, 
    CommissionConfigModule, 
    PayoutSessionModule, 
    LedgerModule, 
    CommonModule,
    TemplateApplyModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
