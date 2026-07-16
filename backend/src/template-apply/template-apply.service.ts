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
    // include: { items: true } — thiếu dòng này sẽ gây lỗi compile
    // "Property 'items' does not exist on type Template" vì findUnique không
    // tự load quan hệ.
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

    // Quyền áp template: root chỉ Admin, còn lại Admin hoặc chủ subtree.
    // Đây là check RIÊNG của template-apply (khác cap/orphan check của
    // commission-config), nên giữ ở đây — không trùng lặp gì với Phần B.
    if (user.parentId === null) {
      if (actor.type !== 'ADMIN') {
        throw new ForbiddenException('Only Admin can apply template to root MIB user');
      }
    } else if (actor.type !== 'ADMIN') {
      const subtreeResult = await this.prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE subtree AS (
          SELECT id FROM "User" WHERE id = ${actor.id}
          UNION ALL
          SELECT u.id FROM "User" u
          INNER JOIN subtree s ON u."parentId" = s.id
        )
        SELECT id FROM subtree WHERE id = ${userId}
        LIMIT 1;
      `;
      if (subtreeResult.length === 0) {
        throw new ForbiddenException('You do not have permission to apply template to this user');
      }
    }

    if (template.items.length === 0) {
      throw new BadRequestException('Template has no items to apply');
    }

    // TÁI SỬ DỤNG commissionConfigService.upsert() cho từng item, truyền `tx`
    // để mọi write (kể cả AuditLog con mà upsert() tự ghi) nằm trong CÙNG 1
    // transaction — 1 item fail thì Prisma tự rollback toàn bộ, không cần tự
    // viết lại cap/orphan/ancestor check ở đây.
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
          // Báo rõ item nào fail rồi ném lại — throw bên trong callback của
          // $transaction khiến Prisma rollback toàn bộ các item đã apply
          // trước đó trong cùng lần gọi này.
          throw new BadRequestException(
            `Apply template thất bại ở assetId ${item.assetId}: ${err.message}`,
          );
        }
      }
      return results;
    });

    // AuditLog cấp Template — ghi SAU khi transaction đã commit thành công,
    // không cần nằm trong tx vì đây chỉ là log tổng hợp, không phải dữ liệu
    // tài chính cần rollback cùng.
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