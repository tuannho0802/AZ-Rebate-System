import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { LedgerService } from './ledger.service';

@Controller('payout-sessions/:sessionId/ledger')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class LedgerController {
    constructor(private readonly ledgerService: LedgerService) { }

    @Get()
    findMany(@Param('sessionId') sessionId: string, @Query() pagination: PaginationDto) {
        return this.ledgerService.findMany(sessionId, pagination);
    }
}