import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { Prisma } from '@prisma/client';
import { maskConfigForActor } from '../common/mask-commission.util';

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

  /** Tách total thành (rebate, markup) theo rule "ăn rebate của cha trước". */
  private splitByPriority(
    total: number,
    parentRebate: number,
    parentMarkup: number,
  ): { rebateUnit: number; markupPips: number } {
    const rebateUnit = Math.min(parentRebate, total);
    const markupPips = total - rebateUnit; // đảm bảo <= parentMarkup nếu total <= parentTotal
    return { rebateUnit, markupPips };
  }

  /**
   * Tự động hạ bất kỳ con/cháu nào đang vượt TỔNG mới của cha.
   *
   * Logic dựa theo TỔNG (phương án A đã chốt):
   * - newParentTotal = newRebate + newMarkup
   * - Với mỗi con: curTotal = curRebate + curMarkup
   * - Nếu curTotal <= newParentTotal → không đổi gì (kể cả khi tỷ lệ
   *   rebate/markup riêng lẻ của con > cha — linh hoạt breakdown).
   * - Nếu curTotal > newParentTotal → tính lại bằng splitByPriority()
   *   dùng giá trị MỚI của cha làm mốc tách.
   *
   * Chạy dựa vào đúng 1 transaction, ghi AuditLog riêng cho từng dòng bị
   * điều chỉnh, đệ quy xuống cháu chắt.
   */
  private async cascadeClampDescendants(
    userId: string,
    assetId: string,
    newRebate: number,
    newMarkup: number,
    actor: RequestActor,
    client: DbClient,
  ): Promise<void> {
    const children = await client.user.findMany({ where: { parentId: userId }, select: { id: true } });
    if (children.length === 0) return;

    const childIds = children.map((c) => c.id);
    const childConfigs = await client.userCommissionConfig.findMany({
      where: { assetId, userId: { in: childIds } },
    });

    const newParentTotal = newRebate + newMarkup;

    for (const cfg of childConfigs) {
      const curRebate = Number(cfg.rebateUnit);
      const curMarkup = Number(cfg.markupPips);
      const curTotal = curRebate + curMarkup;

      // Nếu tổng con <= tổng cha mới → hợp lệ, bỏ qua (không tạo AuditLog thừa)
      if (curTotal <= newParentTotal) {
        continue;
      }

      // Tổng con > tổng cha mới → hạ tổng con xuống = newParentTotal,
      // tách rebate/markup bằng splitByPriority() (ưu tiên lấy rebate cha trước)
      const { rebateUnit: clampedRebate, markupPips: clampedMarkup } =
        this.splitByPriority(newParentTotal, newRebate, newMarkup);

      const updated = await client.userCommissionConfig.update({
        where: { id: cfg.id },
        data: {
          rebateUnit: clampedRebate,
          markupPips: clampedMarkup,
          transferUnit: clampedRebate + clampedMarkup,
          version: cfg.version + 1,
        },
      });

      const tx = client === this.prisma ? undefined : (client as Prisma.TransactionClient);
      await this.auditLog.createLog(
        {
          actorId: actor.id,
          actorType: actor.type,
          action: 'AUTO_CASCADE_ADJUST_COMMISSION_CONFIG',
          entityType: 'UserCommissionConfig',
          entityId: updated.id,
          beforeData: cfg,
          afterData: { ...updated, reason: `Cha (${userId}) đổi thành rebate=${newRebate}/markup=${newMarkup} (tổng=${newParentTotal}), con tổng=${curTotal} vượt → hạ xuống ${clampedRebate}/${clampedMarkup}` },
        },
        tx,
      );

      // Đệ quy xuống cháu, dùng giá trị MỚI (đã clamp) của con này làm mốc mới
      await this.cascadeClampDescendants(cfg.userId, assetId, clampedRebate, clampedMarkup, actor, client);
    }
  }

  async upsert(dto: UpsertConfigDto, actor: RequestActor, tx?: Prisma.TransactionClient, bypassSplit = false) {
    if (tx) {
      return this._executeUpsert(dto, actor, tx, bypassSplit);
    }
    return this.prisma.$transaction(async (innerTx) => {
      return this._executeUpsert(dto, actor, innerTx, bypassSplit);
    });
  }

  private async _executeUpsert(dto: UpsertConfigDto, actor: RequestActor, tx: Prisma.TransactionClient, bypassSplit = false) {
    const { userId, assetId } = dto;

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const isRoot = user.parentId === null;

    let rebateUnit: number;
    let markupPips: number;

    if (actor.type === 'ADMIN') {
      // Admin: bypass hoàn toàn cap-check của cha (hành vi cũ, edge case #8 đã chốt).
      if (dto.rebateUnit === undefined || dto.markupPips === undefined) {
        throw new BadRequestException('Bắt buộc phải cung cấp rebateUnit và markupPips');
      }
      rebateUnit = dto.rebateUnit;
      markupPips = dto.markupPips;
    } else if (bypassSplit) {
      // Non-admin áp template (MIB/IB): được set rebate/markup lẻ thay vì chỉ transferUnit,
      // NHƯNG vẫn phải tuân thủ cap của cha trực tiếp — không được bypass check này.
      if (dto.rebateUnit === undefined || dto.markupPips === undefined) {
        throw new BadRequestException('Bắt buộc phải cung cấp rebateUnit và markupPips');
      }
      if (isRoot) {
        throw new ForbiddenException('Only Admin can update config for root MIB');
      }

      const { isDirectParent, parentConfig } = await this.resolveParentAccess(userId, actor.id, assetId, tx);
      if (!isDirectParent) throw new ForbiddenException('Only the direct parent can update this user\'s config');
      if (!parentConfig) throw new BadRequestException('Orphan config: direct parent has no config for this asset');

      const requestedTotal = dto.rebateUnit + dto.markupPips;
      if (requestedTotal > parentConfig.rebateUnit + parentConfig.markupPips) {
        throw new BadRequestException(
          `Template item (rebate=${dto.rebateUnit}/markup=${dto.markupPips}, tổng=${requestedTotal}) vượt tổng cha (${parentConfig.rebateUnit + parentConfig.markupPips})`,
        );
      }

      rebateUnit = dto.rebateUnit;
      markupPips = dto.markupPips;
    } else {
      // Non-admin, không phải bypassSplit: logic split cũ, giữ nguyên không đổi
      if (dto.rebateUnit !== undefined || dto.markupPips !== undefined) {
        throw new ForbiddenException('Bạn chỉ được nhập tổng (transferUnit), không được chọn rebate/markup riêng');
      }
      if (dto.transferUnit === undefined) {
        throw new BadRequestException('Thiếu transferUnit');
      }
      if (isRoot) {
        throw new ForbiddenException('Only Admin can update config for root MIB');
      }

      const { isDirectParent, parentConfig } = await this.resolveParentAccess(userId, actor.id, assetId, tx);
      if (!isDirectParent) throw new ForbiddenException('Only the direct parent can update this user\'s config');
      if (!parentConfig) throw new BadRequestException('Orphan config: direct parent has no config for this asset');
      if (dto.transferUnit > parentConfig.rebateUnit + parentConfig.markupPips) {
        throw new BadRequestException(
          `transferUnit ${dto.transferUnit} exceeds parent total ${parentConfig.rebateUnit + parentConfig.markupPips}`,
        );
      }

      const split = this.splitByPriority(dto.transferUnit, parentConfig.rebateUnit, parentConfig.markupPips);
      rebateUnit = split.rebateUnit;
      markupPips = split.markupPips;
    }

    const transferUnit = rebateUnit + markupPips;
    const existing = await tx.userCommissionConfig.findUnique({ where: { userId_assetId: { userId, assetId } } });

    const saved = existing
      ? await tx.userCommissionConfig.update({
        where: { userId_assetId: { userId, assetId } },
        data: { rebateUnit, markupPips, transferUnit, version: existing.version + 1 },
      })
      : await tx.userCommissionConfig.create({
        data: { userId, assetId, rebateUnit, markupPips, transferUnit, version: 1 },
      });

    await this.auditLog.createLog(
      {
        actorId: actor.id,
        actorType: actor.type,
        action: existing ? 'UPDATE_COMMISSION_CONFIG' : 'UPSERT_COMMISSION_CONFIG',
        entityType: 'UserCommissionConfig',
        entityId: saved.id,
        beforeData: existing ?? null,
        afterData: saved,
      },
      tx,
    );

    // Tự động hạ cấp dưới
    await this.cascadeClampDescendants(userId, assetId, rebateUnit, markupPips, actor, tx);

    return maskConfigForActor(saved, actor);
  }

  async update(userId: string, assetId: string, dto: UpdateConfigDto, actor: RequestActor, tx?: Prisma.TransactionClient) {
    if (tx) {
      return this._executeUpdate(userId, assetId, dto, actor, tx);
    }
    return this.prisma.$transaction(async (innerTx) => {
      return this._executeUpdate(userId, assetId, dto, actor, innerTx);
    });
  }

  private async _executeUpdate(userId: string, assetId: string, dto: UpdateConfigDto, actor: RequestActor, tx: Prisma.TransactionClient) {
    const { version } = dto;

    const existing = await tx.userCommissionConfig.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });
    if (!existing) {
      throw new NotFoundException('Commission config not found');
    }
    if (version !== existing.version) {
      throw new ConflictException('Config has been modified by another user');
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isRoot = user.parentId === null;

    let rebateUnit: number;
    let markupPips: number;

    if (actor.type === 'ADMIN') {
      if (dto.rebateUnit === undefined && dto.markupPips === undefined && dto.transferUnit === undefined) {
        throw new BadRequestException('Phải cung cấp ít nhất một trường giá trị để cập nhật');
      }
      rebateUnit = dto.rebateUnit !== undefined ? dto.rebateUnit : Number(existing.rebateUnit);
      markupPips = dto.markupPips !== undefined ? dto.markupPips : Number(existing.markupPips);
      if (dto.transferUnit !== undefined) {
        // Nếu admin gửi transferUnit, split ưu tiên rebate
        const split = this.splitByPriority(dto.transferUnit, rebateUnit, markupPips);
        rebateUnit = split.rebateUnit;
        markupPips = split.markupPips;
      }
    } else {
      // Non-admin: Chỉ nhận transferUnit
      if (dto.rebateUnit !== undefined || dto.markupPips !== undefined) {
        throw new ForbiddenException('Bạn chỉ được nhập tổng (transferUnit), không được chọn rebate/markup riêng');
      }
      if (dto.transferUnit === undefined) {
        throw new BadRequestException('Thiếu transferUnit');
      }
      if (isRoot) {
        throw new ForbiddenException('Only Admin can update config for root MIB');
      }

      const { isDirectParent, parentConfig } = await this.resolveParentAccess(userId, actor.id, assetId, tx);
      if (!isDirectParent) throw new ForbiddenException('Only the direct parent can update this user\'s config');
      if (!parentConfig) throw new BadRequestException('Orphan config: direct parent has no config for this asset');
      if (dto.transferUnit > parentConfig.rebateUnit + parentConfig.markupPips) {
        throw new BadRequestException(
          `transferUnit ${dto.transferUnit} exceeds parent total ${parentConfig.rebateUnit + parentConfig.markupPips}`,
        );
      }

      const split = this.splitByPriority(dto.transferUnit, parentConfig.rebateUnit, parentConfig.markupPips);
      rebateUnit = split.rebateUnit;
      markupPips = split.markupPips;
    }

    const transferUnit = rebateUnit + markupPips;
    const updated = await tx.userCommissionConfig.update({
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
      entityId: existing.id,
      beforeData: existing,
      afterData: updated,
    }, tx);

    // Tự động hạ cấp dưới
    await this.cascadeClampDescendants(userId, assetId, rebateUnit, markupPips, actor, tx);

    return maskConfigForActor(updated, actor);
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
        WHERE s.depth < 50
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

    const isAdmin = actor.type === 'ADMIN';

    return {
      self: {
        userId,
        email: self.email,
        transferUnit: selfCfg ? Number(selfCfg.rebateUnit) + Number(selfCfg.markupPips) : null,
        ...(isAdmin && {
          rebateUnit: selfCfg ? Number(selfCfg.rebateUnit) : null,
          markupPips: selfCfg ? Number(selfCfg.markupPips) : null,
        }),
        version: selfCfg ? selfCfg.version : null,
      },
      children: children.map((c) => {
        const cfg = cfgMap.get(c.id);
        return {
          userId: c.id,
          email: c.email,
          role: c.role,
          isActive: c.isActive,
          transferUnit: cfg ? Number(cfg.rebateUnit) + Number(cfg.markupPips) : null,
          ...(isAdmin && {
            rebateUnit: cfg ? Number(cfg.rebateUnit) : null,
            markupPips: cfg ? Number(cfg.markupPips) : null,
          }),
          version: cfg ? cfg.version : null,
        };
      }),
    };
  }

  /**
   * Non-admin (MIB/IB) xem TONG (transferUnit) cua CHINH MINH cho MOI asset dang
   * co config, trong 1 lan goi — dung cho trang "Assets View". LUON mask breakdown,
   * chi tra transferUnit — khong bao gio tra rebateUnit/markupPips du actor la ai,
   * vi endpoint nay chi de MIB/IB tu xem, khong co ly do can breakdown that.
   * Admin khong co config ca nhan nen khong goi duoc endpoint nay.
   */
  async getMySummary(actor: RequestActor) {
    if (actor.type === 'ADMIN') {
      throw new ForbiddenException('Admin does not have a personal commission config');
    }
    const configs = await this.prisma.userCommissionConfig.findMany({
      where: { userId: actor.id },
      include: { asset: true },
    });
    return configs.map((c) => ({
      assetId: c.assetId,
      assetCode: c.asset.code,
      assetName: c.asset.name,
      transferUnit: Number(c.rebateUnit) + Number(c.markupPips),
      version: c.version,
    }));
  }
}