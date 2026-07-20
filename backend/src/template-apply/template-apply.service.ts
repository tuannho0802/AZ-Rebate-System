import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CommissionConfigService } from '../commission-config/commission-config.service';

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

  async applyTemplate(templateId: string, userId: string, actor: RequestActor) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { items: true },
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

    if (template.items.length === 0) {
      throw new BadRequestException('Template has no items to apply');
    }

    // TÁI SỬ DỤNG commissionConfigService.upsert() cho từng item, truyền `tx`
    // để mọi write (kể cả AuditLog con mà upsert() tự ghi) nằm trong CÙNG 1
    // transaction — 1 item fail thì Prisma tự rollback toàn bộ. Với permission
    // check đã đúng ở trên, cap/orphan check bên trong upsert() giờ chỉ còn
    // là lớp phòng thủ thứ 2 (defense in depth), không phải lớp chặn chính.
    const appliedConfigs = await this.prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof this.commissionConfigService.upsert>>[] = [];
      for (const item of template.items) {
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

    await this.auditLog.createLog({
      actorId: actor.id,
      actorType: actor.type,
      action: 'APPLY_TEMPLATE',
      entityType: 'Template',
      entityId: templateId,
      beforeData: null,
      afterData: { templateId, userId, appliedConfigs },
    });

    return appliedConfigs;
  }
}