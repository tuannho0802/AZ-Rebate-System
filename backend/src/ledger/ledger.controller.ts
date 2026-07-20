import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { LedgerService } from './ledger.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiOkResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';

@ApiTags('Ledger')
@Controller('payout-sessions/:sessionId/ledger')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class LedgerController {
    constructor(private readonly ledgerService: LedgerService) { }

    @Get()
    @ApiOperation({ summary: 'List ledger entries', description: 'Lấy danh sách bản ghi hoa hồng cho payout session' })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'sessionId', description: 'ID payout session' })
    @ApiQuery({ name: 'page', required: false, example: 1, description: 'Trang' })
    @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Số bản ghi mỗi trang' })
    @ApiOkResponse({ description: 'Danh sách ledger entries' })
    @ApiNotFoundResponse({ description: 'Session không tồn tại' })
    @ApiForbiddenResponse({ description: 'Không phải Admin' })
    findMany(@Param('sessionId') sessionId: string, @Query() pagination: PaginationDto) {
        return this.ledgerService.findMany(sessionId, pagination);
    }
}
