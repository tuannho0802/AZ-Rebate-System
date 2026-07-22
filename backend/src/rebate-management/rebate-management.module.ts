import { Module } from '@nestjs/common';
import { RebateManagementController } from './rebate-management.controller';
import { RebateManagementService } from './rebate-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RebateManagementController],
  providers: [RebateManagementService],
})
export class RebateManagementModule {}
