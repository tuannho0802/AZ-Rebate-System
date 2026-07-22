import { Module } from '@nestjs/common';
import { TemplateLevelConfigController } from './template-level-config.controller';
import { TemplateLevelConfigService } from './template-level-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateLevelConfigController],
  providers: [TemplateLevelConfigService],
  exports: [TemplateLevelConfigService],
})
export class TemplateLevelConfigModule {}
