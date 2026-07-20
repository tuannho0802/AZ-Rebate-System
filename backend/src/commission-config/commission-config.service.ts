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

export interface UserConfigNode {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  rebateUnit: number | null;
  markupPips: number | null;
  transferUnit: number | null;
  version: number | null;
  children: UserConfigNode[];
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

  /**
   * SIET LAI (theo xac nhan nghiep vu): chi CHA TRUC TIEP moi duoc set config
   * cho con. Khong cho phep to tien xa hon "nhay cap" (skip-level), va khong
   * cho tu sua config chinh minh (vi actor.id se khong bao gio == user.parentId
   * cua chinh no, tru truong hop du lieu loi).
   */
  private async resolveParentAccess(
    userId: string,
    actorId: string,
    assetId: string,
    client: DbClient,
  ): Promise<{ isDirectParent: boolean; parentConfig: NearestAncestorConfig | null }> {
    const user = await client.user.findUnique({ where: { id: userId }, select: { parentId: true } });
    if (!user || !user.parentId) {
      return { isDirectParent: false, parentConfig: null };
    }

    const isDirectParent = user.parentId === actorId;

    const parentCfg = await client.userCommissionConfig.findUnique({
      where: { userId_assetId: { userId: user.parentId, assetId } },
    });

    return {
      isDirectParent,
      parentConfig: parentCfg
        ? { rebateUnit: Number(parentCfg.rebateUnit), markupPips: Number(parentCfg.markupPips) }
        : null,
    };
  }

  /**
   * [MOI] Dam bao bat bien "con <= cha" luon dung o MOI thoi diem, khong chi
   * luc set con. Neu da co con truc tiep dang giu gia tri X cho asset nay,
   * KHONG duoc ha gia tri cua chinh minh xuong duoi X — bat ke actor la
   * Admin hay chinh cha do, va bat ke la root (MIB) hay khong. MIB khong co
   * cha de gioi han tren, nhung van bi gioi han duoi boi chinh con cua no.
   */
  private async assertNoChildExceeds(
    userId: string,
    assetId: string,
    rebateUnit: number,
    markupPips: number,
    client: DbClient,
  ): Promise<void> {
    const childConfigs = await client.userCommissionConfig.findMany({
      where: { assetId, user: { parentId: userId } },
    });

    if (childConfigs.length === 0) return;

    const maxChildRebate = Math.max(...childConfigs.map((c) => Number(c.rebateUnit)));
    const maxChildMarkup = Math.max(...childConfigs.map((c) => Number(c.markupPips)));

    if (rebateUnit < maxChildRebate) {
      throw new BadRequestException(
        `Không thể hạ rebateUnit xuống ${rebateUnit}: đã có con trực tiếp đang được cấp ${maxChildRebate} cho asset này. Hạ cấp con đó trước.`,
      );
    }
    if (markupPips < maxChildMarkup) {
      throw new BadRequestException(
        `Không thể hạ markupPips xuống ${markupPips}: đã có con trực tiếp đang được cấp ${maxChildMarkup} cho asset này. Hạ cấp con đó trước.`,
      );
    }
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
    } else if (actor.type !== 'ADMIN') {
      const { isDirectParent, parentConfig } = await this.resolveParentAccess(
        userId,
        actor.id,
        assetId,
        client,
      );

      if (!isDirectParent) {
        throw new ForbiddenException('Only the direct parent can update this user\'s config');
      }
      if (!parentConfig) {
        throw new BadRequestException('Orphan config: direct parent has no config for this asset');
      }
      if (rebateUnit > parentConfig.rebateUnit) {
        throw new BadRequestException(
          `rebateUnit ${rebateUnit} exceeds parent cap ${parentConfig.rebateUnit}`,
        );
      }
      if (markupPips > parentConfig.markupPips) {
        throw new BadRequestException(
          `markupPips ${markupPips} exceeds parent cap ${parentConfig.markupPips}`,
        );
      }
    }
    // Admin ghi cho non-root: bỏ qua check trần-trên (Admin bypass parent cap như cũ).
    // MỌI trường hợp qua được tới đây (root hoặc không, Admin hoặc không) đều phải
    // qua check trần-dưới sau đây — đây là phần MỚI, trước đây bị bỏ sót hoàn toàn,
    // là nguyên nhân gây ra ledger âm khi cha tự hạ xuống dưới mức con.
    await this.assertNoChildExceeds(userId, assetId, rebateUnit, markupPips, client);
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

  /**
   * ADMIN-ONLY: xem toan bo cay (MIB -> lvN) kem config hoa hong cua tung
   * nguoi cho 1 asset. Dung de build dashboard Admin.
   */
  async getFullTree(rootUserId: string, assetId: string, actor: RequestActor): Promise<UserConfigNode> {
    if (actor.type !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can view the full commission tree');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        parentId: string | null;
        email: string;
        fullName: string | null;
        role: string;
        isActive: boolean;
        depth: number;
        rebateUnit: string | null;
        markupPips: string | null;
        transferUnit: string | null;
        version: number | null;
      }>
    >`
      WITH RECURSIVE subtree AS (
        SELECT u.id, u."parentId", u.email, u."fullName", u.role, u."isActive", 0 AS depth
        FROM "User" u WHERE u.id = ${rootUserId}
        UNION ALL
        SELECT c.id, c."parentId", c.email, c."fullName", c.role, c."isActive", s.depth + 1
        FROM "User" c
        JOIN subtree s ON c."parentId" = s.id
      )
      SELECT s.*, cfg."rebateUnit", cfg."markupPips", cfg."transferUnit", cfg.version
      FROM subtree s
      LEFT JOIN "UserCommissionConfig" cfg ON cfg."userId" = s.id AND cfg."assetId" = ${assetId}
      ORDER BY s.depth ASC;
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Root user not found');
    }

    const nodeById = new Map<string, UserConfigNode>();
    for (const r of rows) {
      nodeById.set(r.id, {
        userId: r.id,
        email: r.email,
        fullName: r.fullName,
        role: r.role,
        isActive: r.isActive,
        rebateUnit: r.rebateUnit === null ? null : Number(r.rebateUnit),
        markupPips: r.markupPips === null ? null : Number(r.markupPips),
        transferUnit: r.transferUnit === null ? null : Number(r.transferUnit),
        version: r.version,
        children: [],
      });
    }
    for (const r of rows) {
      if (r.parentId && nodeById.has(r.parentId)) {
        nodeById.get(r.parentId)!.children.push(nodeById.get(r.id)!);
      }
    }
    return nodeById.get(rootUserId)!;
  }

  /**
   * Xem 1 cap: chinh minh + cac con TRUC TIEP kem config. Actor phai la
   * chinh userId nay (tu xem cay cua minh) hoac Admin.
   */
  async getDirectChildren(userId: string, assetId: string, actor: RequestActor) {
    if (actor.type !== 'ADMIN' && actor.id !== userId) {
      throw new ForbiddenException('You can only view your own direct children');
    }

    const self = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!self) {
      throw new NotFoundException('User not found');
    }

    const [selfCfg, children] = await Promise.all([
      this.prisma.userCommissionConfig.findUnique({ where: { userId_assetId: { userId, assetId } } }),
      this.prisma.user.findMany({ where: { parentId: userId } }),
    ]);

    const childIds = children.map((c) => c.id);
    const childConfigs = childIds.length
      ? await this.prisma.userCommissionConfig.findMany({ where: { assetId, userId: { in: childIds } } })
      : [];
    const cfgMap = new Map(childConfigs.map((c) => [c.userId, c]));

    return {
      self: {
        userId,
        email: self.email,
        rebateUnit: selfCfg ? Number(selfCfg.rebateUnit) : null,
        markupPips: selfCfg ? Number(selfCfg.markupPips) : null,
        version: selfCfg ? selfCfg.version : null,
      },
      children: children.map((c) => {
        const cfg = cfgMap.get(c.id);
        return {
          userId: c.id,
          email: c.email,
          role: c.role,
          isActive: c.isActive,
          rebateUnit: cfg ? Number(cfg.rebateUnit) : null,
          markupPips: cfg ? Number(cfg.markupPips) : null,
          version: cfg ? cfg.version : null,
        };
      }),
    };
  }
}