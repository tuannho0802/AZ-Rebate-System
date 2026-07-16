import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { Prisma } from '@prisma/client';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

interface NearestAncestorConfig {
  rebateUnit: number;
  markupPips: number;
}

// PrismaService and Prisma.TransactionClient expose the same model delegates
// (user, userCommissionConfig, $queryRaw, ...), so a single param type covers
// both "no transaction" (this.prisma) and "inside caller's transaction" (tx).
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CommissionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) { }

  private async resolveAncestorAccess(
    userId: string,
    actorId: string,
    assetId: string,
    client: DbClient,
  ): Promise<{ actorInChain: boolean; nearestAncestorConfig: NearestAncestorConfig | null }> {
    const ancestors = await client.$queryRaw<{ id: string; depth: number }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT id, "parentId", 0 AS depth FROM "User" WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u."parentId", a.depth + 1
        FROM "User" u
        INNER JOIN ancestors a ON u.id = a."parentId"
      )
      SELECT id, depth FROM ancestors;
    `;

    const actorInChain = ancestors.some((a) => a.id === actorId);
    const ancestorIdsExcludingSelf = ancestors.filter((a) => a.id !== userId).map((a) => a.id);

    if (ancestorIdsExcludingSelf.length === 0) {
      return { actorInChain, nearestAncestorConfig: null };
    }

    const configsInChain = await client.userCommissionConfig.findMany({
      where: { assetId, userId: { in: ancestorIdsExcludingSelf } },
    });

    if (configsInChain.length === 0) {
      return { actorInChain, nearestAncestorConfig: null };
    }

    const depthById = new Map(ancestors.map((a) => [a.id, a.depth]));
    let nearest = configsInChain[0];
    let nearestDepth = depthById.get(nearest.userId) ?? Number.MAX_SAFE_INTEGER;
    for (const cfg of configsInChain) {
      const d = depthById.get(cfg.userId) ?? Number.MAX_SAFE_INTEGER;
      if (d < nearestDepth) {
        nearest = cfg;
        nearestDepth = d;
      }
    }

    return {
      actorInChain,
      nearestAncestorConfig: {
        rebateUnit: Number(nearest.rebateUnit),
        markupPips: Number(nearest.markupPips),
      },
    };
  }

  private async assertCanWrite(
    userId: string,
    assetId: string,
    rebateUnit: number,
    markupPips: number,
    actor: RequestActor,
    isRootUser: boolean,
    client: DbClient,
  ): Promise<void> {
    if (isRootUser) {
      if (actor.type !== 'ADMIN') {
        throw new ForbiddenException('Only Admin can update config for root MIB');
      }
      return;
    }

    if (actor.type === 'ADMIN') {
      return;
    }

    const { actorInChain, nearestAncestorConfig } = await this.resolveAncestorAccess(
      userId,
      actor.id,
      assetId,
      client,
    );

    if (!actorInChain) {
      throw new ForbiddenException("You do not have permission to update this user's config");
    }
    if (!nearestAncestorConfig) {
      throw new BadRequestException('Orphan config: parent chain has no config for this asset');
    }
    if (rebateUnit > nearestAncestorConfig.rebateUnit) {
      throw new BadRequestException(
        `rebateUnit ${rebateUnit} exceeds parent cap ${nearestAncestorConfig.rebateUnit}`,
      );
    }
    if (markupPips > nearestAncestorConfig.markupPips) {
      throw new BadRequestException(
        `markupPips ${markupPips} exceeds parent cap ${nearestAncestorConfig.markupPips}`,
      );
    }
  }

  /**
   * `tx`: OPTIONAL Prisma transaction client. Pass this when calling upsert()
   * from inside another service's $transaction (e.g. TemplateApplyService
   * applying several template items atomically), so every query AND the
   * resulting audit log participate in that same transaction and roll back
   * together on failure. When omitted, runs standalone against `this.prisma`
   * exactly as before (used by CommissionConfigController).
   */
  async upsert(dto: UpsertConfigDto, actor: RequestActor, tx?: Prisma.TransactionClient) {
    const client: DbClient = tx ?? this.prisma;
    const { userId, assetId, rebateUnit, markupPips } = dto;

    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.assertCanWrite(userId, assetId, rebateUnit, markupPips, actor, user.parentId === null, client);

    const transferUnit = rebateUnit + markupPips;
    const existing = await client.userCommissionConfig.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });

    if (existing) {
      const updated = await client.userCommissionConfig.update({
        where: { userId_assetId: { userId, assetId } },
        data: { rebateUnit, markupPips, transferUnit, version: existing.version + 1 },
      });

      await this.auditLog.createLog(
        {
          actorId: actor.id,
          actorType: actor.type,
          action: 'UPDATE_COMMISSION_CONFIG',
          entityType: 'UserCommissionConfig',
          entityId: updated.id,
          beforeData: existing,
          afterData: updated,
        },
        tx,
      );

      return updated;
    } else {
      const created = await client.userCommissionConfig.create({
        data: { userId, assetId, rebateUnit, markupPips, transferUnit, version: 1 },
      });

      await this.auditLog.createLog(
        {
          actorId: actor.id,
          actorType: actor.type,
          action: 'UPSERT_COMMISSION_CONFIG',
          entityType: 'UserCommissionConfig',
          entityId: created.id,
          beforeData: null,
          afterData: created,
        },
        tx,
      );

      return created;
    }
  }

  async update(userId: string, assetId: string, dto: UpdateConfigDto, actor: RequestActor) {
    const { rebateUnit, markupPips, version } = dto;

    const existing = await this.prisma.userCommissionConfig.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });
    if (!existing) {
      throw new NotFoundException('Commission config not found');
    }
    if (version !== existing.version) {
      throw new ConflictException('Config has been modified by another user');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newRebateUnit = rebateUnit ?? Number(existing.rebateUnit);
    const newMarkupPips = markupPips ?? Number(existing.markupPips);

    await this.assertCanWrite(userId, assetId, newRebateUnit, newMarkupPips, actor, user.parentId === null, this.prisma);

    const updated = await this.prisma.userCommissionConfig.update({
      where: { userId_assetId: { userId, assetId } },
      data: {
        rebateUnit: newRebateUnit,
        markupPips: newMarkupPips,
        transferUnit: newRebateUnit + newMarkupPips,
        version: existing.version + 1,
      },
    });

    await this.auditLog.createLog({
      actorId: actor.id,
      actorType: actor.type,
      action: 'UPDATE_COMMISSION_CONFIG',
      entityType: 'UserCommissionConfig',
      entityId: existing.id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }
}