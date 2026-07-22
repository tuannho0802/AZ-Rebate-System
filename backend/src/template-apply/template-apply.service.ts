import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CommissionConfigService } from '../commission-config/commission-config.service';
import { TemplateType } from '@prisma/client';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Injectable()
export class TemplateApplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly commissionConfigService: CommissionConfigService,
  ) { }

  private async applyItemTemplate(templateId: string, userId: string, actor: RequestActor) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { items: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.items.length === 0) {
      throw new BadRequestException('Template has no items to apply');
    }

    const meaningfulItems = template.items.filter(
      (item) => Number(item.rebateUnit) !== 0 || Number(item.markupPips) !== 0,
    );

    if (meaningfulItems.length === 0) {
      throw new BadRequestException(
        'Template has no meaningful (non-zero) items to apply — all items are unset placeholders',
      );
    }

    const appliedConfigs = await this.prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof this.commissionConfigService.upsert>>[] = [];
      for (const item of meaningfulItems) {
        try {
          const applied = await this.commissionConfigService.upsert(
            {
              userId,
              assetId: item.assetId,
              rebateUnit: Number(item.rebateUnit),
              markupPips: Number(item.markupPips),
            },
            actor,
            tx,
            true,
          );
          results.push(applied);
        } catch (err) {
          throw new BadRequestException(
            `Apply template thất bại ở assetId ${item.assetId}: ${err.message}`,
          );
        }
      }
      return results;
    });

    return appliedConfigs;
  }

  private async applyLevelTemplate(templateId: string, rootUserId: string, actor: RequestActor) {
    if (actor.type !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can apply LEVEL templates');
    }

    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: {
        levelConfigs: {
          orderBy: [{ level: 'asc' }, { assetId: 'asc' }],
        },
      },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.levelConfigs.length === 0) {
      throw new BadRequestException('Template LEVEL has no level configs to apply');
    }

    const subtreeUsers = await this.prisma.$queryRaw<Array<{ id: string; email: string; level: number }>>`
      WITH RECURSIVE subtree AS (
        SELECT u.id, u.email, u.level
        FROM "User" u
        WHERE u.id = ${rootUserId}
        UNION ALL
        SELECT c.id, c.email, c.level
        FROM "User" c
        JOIN subtree s ON c."parentId" = s.id
      )
      SELECT id, email, level FROM subtree ORDER BY level ASC, email ASC;
    `;

    if (subtreeUsers.length === 0) {
      throw new NotFoundException('User not found');
    }

    const usersByLevel = new Map<number, Array<{ id: string; email: string }>>();
    for (const user of subtreeUsers) {
      const bucket = usersByLevel.get(user.level) ?? [];
      bucket.push({ id: user.id, email: user.email });
      usersByLevel.set(user.level, bucket);
    }

    const appliedConfigs = await this.prisma.$transaction(async (tx) => {
      const results: Array<{
        userId: string;
        email: string;
        level: number;
        assetId: string;
        config: Awaited<ReturnType<typeof this.commissionConfigService.upsert>>;
      }> = [];

      for (const levelConfig of template.levelConfigs) {
        const targets = usersByLevel.get(levelConfig.level) ?? [];
        for (const target of targets) {
          try {
            const config = await this.commissionConfigService.upsert(
              {
                userId: target.id,
                assetId: levelConfig.assetId,
                rebateUnit: Number(levelConfig.rebateUnit),
                markupPips: Number(levelConfig.markupPips),
              },
              actor,
              tx,
              true,
            );
            results.push({
              userId: target.id,
              email: target.email,
              level: levelConfig.level,
              assetId: levelConfig.assetId,
              config,
            });
          } catch (err) {
            throw new BadRequestException(
              `Apply template LEVEL thất bại ở level ${levelConfig.level}, assetId ${levelConfig.assetId}, user ${target.email}: ${err.message}`,
            );
          }
        }
      }

      return results;
    });

    if (appliedConfigs.length === 0) {
      throw new BadRequestException('Template LEVEL không map được tới user nào trong nhánh đích');
    }

    return appliedConfigs;
  }

  async applyTemplate(templateId: string, userId: string, actor: RequestActor) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, type: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // [SUA — theo test-flow-check.js Fail #2]: quyền áp template phải khớp
    // ĐÚNG "quy tắc vàng" LvN chỉ CRUD được cho LvN+1 (con TRỰC TIẾP), giống
    // hệt assertCanWrite() trong CommissionConfigService — KHÔNG còn cho phép
    // "actor nằm bất kỳ đâu trong subtree của target" như trước (quá lỏng,
    // dẫn tới trường hợp MIB áp được cho CHÁU, request chạy tới tận vòng lặp
    // upsert() bên trong mới bị chặn 403 rồi tự bọc lại thành 400 khó hiểu,
    // thay vì bị chặn ngay từ đầu với đúng message 403).
    //   - root (parentId = null): CHỈ Admin.
    //   - còn lại: Admin HOẶC actor CHÍNH LÀ parentId của user (cha trực tiếp).
    if (user.parentId === null) {
      if (actor.type !== 'ADMIN') {
        throw new ForbiddenException('Only Admin can apply template to root MIB user');
      }
    } else if (actor.type !== 'ADMIN' && actor.id !== user.parentId) {
      throw new ForbiddenException('You can only apply a template to your own direct child');
    }

    if (actor.type !== 'ADMIN') {
      const existingLock = await this.prisma.templateLock.findUnique({
        where: { templateId_userId: { templateId, userId: actor.id } },
      });
      if (existingLock) {
        throw new ForbiddenException(
          'Bạn đang bị khóa sử dụng template này — liên hệ cấp trên để mở khóa (unlock) trước khi áp dụng',
        );
      }
    }

    const appliedConfigs =
      template.type === TemplateType.LEVEL
        ? await this.applyLevelTemplate(templateId, userId, actor)
        : await this.applyItemTemplate(templateId, userId, actor);

    await this.auditLog.createLog({
      actorId: actor.id,
      actorType: actor.type,
      action: 'APPLY_TEMPLATE',
      entityType: 'Template',
      entityId: templateId,
      beforeData: null,
      afterData: { templateId, userId, appliedConfigs },
    });

    // [SUA — bug double-mask]: appliedConfigs đã được mask TỪNG ITEM ngay bên
    // trong vòng lặp ở trên (commissionConfigService.upsert() luôn tự mask
    // trước khi return — xem dòng cuối của hàm upsert()). Mask lại lần 2 ở
    // đây là THỪA và SAI: với actor không phải Admin, item trong appliedConfigs
    // đã không còn field rebateUnit/markupPips (bị destructure mất từ lần mask
    // trước) — maskConfigForActor gọi lần 2 sẽ tính lại
    // maxPips = Number(undefined) + Number(undefined) = NaN, ghi đè lên
    // maxPips ĐÚNG đã có sẵn. Trả thẳng appliedConfigs, không mask lại.
    return appliedConfigs;
  }
}
