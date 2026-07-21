import { Module } from '@nestjs/common';
import { TemplateLockService } from './template-lock.service';
import { TemplateLockController } from './template-lock.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateLockController],
  providers: [TemplateLockService],
  exports: [TemplateLockService],
})
export class TemplateLockModule {}
