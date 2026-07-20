import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IntegrityService } from './integrity.service';

export interface RequestActor {
    id: string;
    type: 'ADMIN' | 'USER';
}

@Controller('admin/integrity-check')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class IntegrityController {
    constructor(private readonly integrityService: IntegrityService) { }

    /**
     * GET /admin/integrity-check
     * Quét toàn hệ thống tìm chuỗi cha-con bị lệch, log console + ghi 1 dòng
     * AuditLog tổng hợp, trả về danh sách chi tiết ngay trên response.
     */
    @Get()
    scan(@CurrentUser() user: RequestActor) {
        return this.integrityService.scanChainViolations(user.id);
    }
}