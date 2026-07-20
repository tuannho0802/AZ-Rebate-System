import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IntegrityService } from './integrity.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponse, ApiForbiddenResponse } from '@nestjs/swagger';

export interface RequestActor {
    id: string;
    type: 'ADMIN' | 'USER';
}

@ApiTags('Integrity Check')
@Controller('admin/integrity-check')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class IntegrityController {
    constructor(private readonly integrityService: IntegrityService) { }

    @Get()
    @ApiOperation({ summary: 'Scan chain integrity', description: 'Quét toàn hệ thống tìm chuỗi cha-con bị lệch, trả về danh sách vi phạm' })
    @ApiBearerAuth('access-token')
    @ApiOkResponse({ description: 'Danh sách vi phạm chain (violations)' })
    @ApiForbiddenResponse({ description: 'Không phải Admin' })
    scan(@CurrentUser() user: RequestActor) {
        return this.integrityService.scanChainViolations(user.id);
    }
}
