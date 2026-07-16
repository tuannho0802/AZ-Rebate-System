import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PayoutSessionStatus, CommissionLedger } from '@prisma/client';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { Decimal } from '@prisma/client/runtime/library'; // FIX #1: correct import path

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Core Net-Pips algorithm. Called ONLY from PayoutSessionService.lock(),
   * inside the same transaction that flips status -> LOCKED.
   * This is where the real logic lives now (FIX #3: no more dead-code placeholder).
   */
  async generateForSession(sessionId: string, tx: Prisma.TransactionClient): Promise<void> {
    const session = await tx.payoutSession.findUnique({
      where: { id: sessionId },
      include: { sourceUser: true, asset: true },
    });
    if (!session) {
      throw new NotFoundException('Payout session not found');
    }
    if (session.status === PayoutSessionStatus.COMPLETED) {
      throw new BadRequestException('Ledger is locked for a completed session');
    }

    // 1️⃣ + 2️⃣ Build active ancestor chain (upward), quoted "parentId"/"isActive"
    const activeChainRows = await tx.$queryRaw<{ id: string; depth: number }[]>`
      WITH RECURSIVE path_up AS (
        SELECT u.id, u."parentId", 0 AS depth
        FROM "User" u
        WHERE u.id = ${session.sourceUserId}
        UNION ALL
        SELECT p.id, p."parentId", pu.depth + 1
        FROM "User" p
        JOIN path_up pu ON p.id = pu."parentId"
      )
      SELECT pu.id, pu.depth
      FROM path_up pu
      JOIN "User" u ON u.id = pu.id
      WHERE u."isActive" = true
      ORDER BY pu.depth ASC;
    `;

    if (activeChainRows.length === 0) {
      throw new BadRequestException('No active users in the ancestor chain');
    }

    const activeUserIds = activeChainRows.map((r) => r.id);

    // 3️⃣ Load configs for the asset, only for active-chain users
    const configs = await tx.userCommissionConfig.findMany({
      where: {
        userId: { in: activeUserIds },
        assetId: session.assetId,
      },
    });
    const configMap = new Map(configs.map((c) => [c.userId, c]));

    // 4️⃣ Compute Net values top (highest depth) -> source (depth 0)
    const ledgerRows: Prisma.CommissionLedgerCreateManyInput[] = [];

    for (let i = activeChainRows.length - 1; i >= 0; i--) {
      const curId = activeChainRows[i].id;
      const curCfg = configMap.get(curId);
      if (!curCfg) {
        throw new BadRequestException(
          `Missing commission config for user ${curId} and asset ${session.assetId}`,
        );
      }

      let netRebate = new Decimal(curCfg.rebateUnit as unknown as string);
      let netMarkup = new Decimal(curCfg.markupPips as unknown as string);

      if (i > 0) {
        const childId = activeChainRows[i - 1].id;
        const childCfg = configMap.get(childId);
        if (childCfg) {
          netRebate = netRebate.minus(new Decimal(childCfg.rebateUnit as unknown as string));
          netMarkup = netMarkup.minus(new Decimal(childCfg.markupPips as unknown as string));
        }
      }

      const netTransfer = netRebate.plus(netMarkup);
      const calculatedValue = netTransfer.times(new Decimal(session.baseVolume as unknown as string));

      ledgerRows.push({
        payoutSessionId: sessionId,
        beneficiaryId: curId,
        assetId: session.assetId,
        netRebate,
        netMarkup,
        netTransferUnit: netTransfer,
        calculatedValue,
      });
    }

    // 5️⃣ Insert all ledger rows in bulk, inside the caller's transaction
    await tx.commissionLedger.createMany({ data: ledgerRows });
  }

  /**
   * Read-only: list ledger entries for a session, paginated.
   * SubtreeGuard is applied at the controller level.
   */
  async findMany(
    sessionId: string,
    pagination: PaginationDto,
  ): Promise<CommissionLedger[]> {
    // FIX #2: correct return type (actual rows, not a `where` filter type)
    const { page = 1, limit = 20, sort = 'createdAt' } = pagination;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    return this.prisma.commissionLedger.findMany({
      where: { payoutSessionId: sessionId },
      skip,
      take,
      orderBy: { [sort]: 'desc' },
    });
  }
}