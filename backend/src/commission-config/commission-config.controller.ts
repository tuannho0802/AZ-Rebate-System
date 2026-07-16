import { Controller, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { CommissionConfigService } from './commission-config.service';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Controller('commission-configs')
@UseGuards(JwtAuthGuard)
export class CommissionConfigController {
  constructor(private readonly commissionConfigService: CommissionConfigService) {}

  @Post()
  upsert(@Body() dto: UpsertConfigDto, @CurrentUser() user: RequestActor) {
    return this.commissionConfigService.upsert(dto, user);
  }

  @Patch(':userId-:assetId')
  update(
    @Param('userId') userId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: RequestActor,
  ) {
    return this.commissionConfigService.update(userId, assetId, dto, user);
  }
}
