import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutSessionStatus } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePayoutSessionDto } from './dto/create-payout-session.dto';

@Injectable()
export class PayoutSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly ledgerService: LedgerService, // FIX #3: inject LedgerService, delegate the algorithm to it
  ) { }

  /**
   * Create a new payout session in DRAFT status.
   */
  async create(dto: CreatePayoutSessionDto, actorAdminId: string) {
    const { name, note, baseVolume, sourceUserId, assetId } = dto;

    // Check source user exists
    const sourceUser = await this.prisma.user.findUnique({ where: { id: sourceUserId } });
    if (!sourceUser) {
      throw new NotFoundException('Source user not found');
    }

    // Check asset exists
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const session = await this.prisma.payoutSession.create({
      data: {
        name,
        note,
        baseVolume,
        sourceUserId,
        assetId,
        createdByAdminId: actorAdminId,
        status: PayoutSessionStatus.DRAFT,
      },
    });

    await this.auditLog.createLog({
      actorId: actorAdminId,
      actorType: 'ADMIN',
      action: 'CREATE_PAYOUT_SESSION',
      entityType: 'PayoutSession',
      entityId: session.id,
      beforeData: null,
      afterData: session,
    });

    return session;
  }

  /**
   * Lock a payout session (DRAFT -> LOCKED) and generate ledger rows.
   * Everything runs inside a single transaction for atomicity.
   *
   * actorAdminId: FIX #4 — real caller identity for the audit log, must be
   * passed by the controller from the authenticated admin (req.admin.id).
   */
  async lock(sessionId: string, actorAdminId: string): Promise<void> {
    const session = await this.prisma.payoutSession.findUnique({
      where: { id: sessionId },
      include: { sourceUser: true, asset: true },
    });
    if (!session) {
      throw new NotFoundException('Payout session not found');
    }
    if (session.status !== PayoutSessionStatus.DRAFT) {
      throw new ConflictException('Session must be in DRAFT status to lock');
    }
    if (!session.sourceUser.isActive) {
      throw new BadRequestException('Source user is inactive');
    }
    if (!session.asset.isActive) {
      throw new BadRequestException('Asset is inactive');
    }

    const beforeData = { ...session };

    await this.prisma.$transaction(async (tx) => {
      // 1️⃣ Flip status to LOCKED
      await tx.payoutSession.update({
        where: { id: sessionId },
        data: { status: PayoutSessionStatus.LOCKED },
      });

      // 2️⃣ Delegate the actual Net-Pips computation + ledger insert to LedgerService,
      //    passing the same transaction client so it's fully atomic.
      await this.ledgerService.generateForSession(sessionId, tx);

      // 3️⃣ Audit log for the lock operation
      const afterData = await tx.payoutSession.findUnique({ where: { id: sessionId } });
      await this.auditLog.createLog({
        actorId: actorAdminId,
        actorType: 'ADMIN',
        action: 'LOCK_PAYOUT_SESSION',
        entityType: 'PayoutSession',
        entityId: sessionId,
        beforeData,
        afterData,
      });
    });
  }

  /**
   * Mark a payout session as COMPLETED. Admin-only (enforced at controller via AdminOnlyGuard).
   */
  async complete(sessionId: string, actorAdminId: string): Promise<void> {
    const session = await this.prisma.payoutSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Payout session not found');
    }
    if (session.status !== PayoutSessionStatus.LOCKED) {
      throw new ConflictException('Only LOCKED sessions can be completed');
    }

    const beforeData = { ...session };

    await this.prisma.payoutSession.update({
      where: { id: sessionId },
      data: { status: PayoutSessionStatus.COMPLETED },
    });

    const afterData = await this.prisma.payoutSession.findUnique({ where: { id: sessionId } });
    await this.auditLog.createLog({
      actorId: actorAdminId,
      actorType: 'ADMIN',
      action: 'COMPLETE_PAYOUT_SESSION',
      entityType: 'PayoutSession',
      entityId: sessionId,
      beforeData,
      afterData,
    });
  }

  /**
   * Get payout session by ID with ledger entries.
   */
  async findOne(sessionId: string) {
    return this.prisma.payoutSession.findUnique({
      where: { id: sessionId },
      include: { ledgerEntries: true },
    });
  }
}