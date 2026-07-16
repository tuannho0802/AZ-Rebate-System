import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

interface NearestAncestorConfig {
  rebateUnit: number;
  markupPips: number;
}

@Injectable()
export class CommissionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) { }

  /**
   * Dùng chung cho cả upsert() và update() — tránh lặp logic ở 2 nơi rồi lệch nhau
   * theo thời gian (đúng pattern lỗi đã bị bắt ≥3 lần trong dự án này).
   *
   * Trả về:
   *  - actorAllowed: actor có quyền sửa config của userId không (Admin luôn true)
   *  - nearestAncestorConfig: config của tổ tiên GẦN NHẤT VỀ CÂY PHÂN CẤP (không phải
   *    gần nhất về thời gian tạo) có config cho assetId này — dùng để cap check.
   *    null nếu KHÔNG một tổ tiên nào có config asset đó (= orphan, phải chặn).
   *
   * QUAN TRỌNG: "gần nhất" ở đây là depth nhỏ nhất trong CTE (đi từ userId lên root),
   * KHÔNG PHẢI ORDER BY "createdAt". Một ancestor xa hơn nhưng có config tạo sau vẫn
   * phải xếp sau ancestor gần hơn có config tạo trước — nếu không sẽ cap-check nhầm
   * đối tượng.
   */
  private async resolveAncestorAccess(
    userId: string,
    actorId: string,
    assetId: string,
  ): Promise<{ actorInChain: boolean; nearestAncestorConfig: NearestAncestorConfig | null }> {
    // depth 0 = chính userId, depth 1 = cha trực tiếp, depth 2 = ông, v.v.
    const ancestors = await this.prisma.$queryRaw<{ id: string; depth: number }[]>`
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

    const ancestorIdsExcludingSelf = ancestors
      .filter((a) => a.id !== userId)
      .map((a) => a.id);

    if (ancestorIdsExcludingSelf.length === 0) {
      return { actorInChain, nearestAncestorConfig: null };
    }

    const configsInChain = await this.prisma.userCommissionConfig.findMany({
      where: {
        assetId,
        userId: { in: ancestorIdsExcludingSelf },
      },
    });

    if (configsInChain.length === 0) {
      return { actorInChain, nearestAncestorConfig: null };
    }

    // Ghép depth vào từng config rồi chọn depth nhỏ nhất (gần userId nhất trong cây).
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

  /**
   * Kiểm tra toàn bộ rule cho 1 lần ghi (dùng chung upsert + update):
   * - root MIB: chỉ Admin
   * - không phải Admin: phải nằm trong ancestor chain + orphan check + cap check
   * Ném exception tương ứng nếu vi phạm. Không return gì — chỉ validate.
   */
  private async assertCanWrite(
    userId: string,
    assetId: string,
    rebateUnit: number,
    markupPips: number,
    actor: RequestActor,
    isRootUser: boolean,
  ): Promise<void> {
    if (isRootUser) {
      if (actor.type !== 'ADMIN') {
        throw new ForbiddenException('Only Admin can update config for root MIB');
      }
      return; // Admin sửa root: không cần ancestor/cap check (không có cha để so).
    }

    if (actor.type === 'ADMIN') {
      return; // Admin bỏ qua toàn bộ ancestor/cap/orphan check.
    }

    const { actorInChain, nearestAncestorConfig } = await this.resolveAncestorAccess(
      userId,
      actor.id,
      assetId,
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

  async upsert(dto: UpsertConfigDto, actor: RequestActor) {
    const { userId, assetId, rebateUnit, markupPips } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.assertCanWrite(userId, assetId, rebateUnit, markupPips, actor, user.parentId === null);

    const transferUnit = rebateUnit + markupPips;
    const existing = await this.prisma.userCommissionConfig.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });

    if (existing) {
      const updated = await this.prisma.userCommissionConfig.update({
        where: { userId_assetId: { userId, assetId } },
        data: {
          rebateUnit,
          markupPips,
          transferUnit,
          version: existing.version + 1,
        },
      });

      await this.auditLog.createLog({
        actorId: actor.id,
        actorType: actor.type,
        action: 'UPDATE_COMMISSION_CONFIG',
        entityType: 'UserCommissionConfig',
        entityId: updated.id,
        beforeData: existing,
        afterData: updated,
      });

      return updated;
    } else {
      const created = await this.prisma.userCommissionConfig.create({
        data: {
          userId,
          assetId,
          rebateUnit,
          markupPips,
          transferUnit,
          version: 1,
        },
      });

      await this.auditLog.createLog({
        actorId: actor.id,
        actorType: actor.type,
        action: 'UPSERT_COMMISSION_CONFIG',
        entityType: 'UserCommissionConfig',
        entityId: created.id,
        beforeData: null,
        afterData: created,
      });

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

    await this.assertCanWrite(userId, assetId, newRebateUnit, newMarkupPips, actor, user.parentId === null);

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