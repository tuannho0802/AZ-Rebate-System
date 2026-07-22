import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Injectable()
export class TemplateLockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra actorId có phải là TỔ TIÊN (bất kỳ cấp nào) của targetUserId hay không.
   * Dùng truy vấn đệ quy CTE đi ngược từ target lên root, tìm xem actorId
   * có nằm trên đường đi không.
   *
   * Tương tự cách SubtreeViewGuard đã nới từ "cha trực tiếp" sang "bất kỳ
   * tổ tiên trong subtree" — tiền lệ đã có trong codebase.
   */
  private async isAncestorOf(actorId: string, targetUserId: string): Promise<boolean> {
    // Đi ngược lên từ target, liệt kê toàn bộ tổ tiên (max 50 cấp để tránh vòng lặp vô hạn)
    const ancestors = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE ancestors AS (
        SELECT u.id, u."parentId", 0 AS depth
        FROM "User" u WHERE u.id = ${targetUserId}
        UNION ALL
        SELECT p.id, p."parentId", a.depth + 1
        FROM "User" p
        JOIN ancestors a ON a."parentId" = p.id
        WHERE a.depth < 50
      )
      SELECT id FROM ancestors WHERE id = ${actorId} AND depth > 0
      LIMIT 1;
    `;
    return ancestors.length > 0;
  }

  async lockTemplate(templateId: string, targetUserId: string, actor: RequestActor) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    // Quyền: Admin HOẶC bất kỳ tổ tiên nào trong cây (không chỉ cha trực tiếp)
    if (actor.type !== 'ADMIN') {
      const isAncestor = await this.isAncestorOf(actor.id, targetUserId);
      if (!isAncestor) {
        throw new ForbiddenException('Chỉ Admin hoặc tổ tiên trong cây mới lock/unlock được template cho user này');
      }
    }

    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.level !== target.level) {
      throw new BadRequestException(`Template level=${template.level} không khớp level=${target.level} của user này`);
    }
    return this.prisma.templateLock.upsert({
      where: { templateId_userId: { templateId, userId: targetUserId } },
      update: {},
      create: { templateId, userId: targetUserId, lockedByType: actor.type, lockedById: actor.id },
    });
  }

  async unlockTemplate(templateId: string, targetUserId: string, actor: RequestActor) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    // Quyền: Admin HOẶC bất kỳ tổ tiên nào trong cây
    if (actor.type !== 'ADMIN') {
      const isAncestor = await this.isAncestorOf(actor.id, targetUserId);
      if (!isAncestor) {
        throw new ForbiddenException('Chỉ Admin hoặc tổ tiên trong cây mới lock/unlock được template cho user này');
      }
    }

    return this.prisma.templateLock.deleteMany({ where: { templateId, userId: targetUserId } });
  }

  /** Danh sách template user này ĐƯỢC PHÉP thấy: đúng level + chưa bị lock. */
  async listVisibleTemplates(actor: RequestActor) {
    if (actor.type === 'ADMIN') {
      return this.prisma.template.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          level: true,
          createdAt: true,
          updatedAt: true,
          createdByAdminId: true,
          items: {
            select: {
              id: true,
              templateId: true,
              assetId: true,
              rebateUnit: true,
              markupPips: true,
              asset: true,
            }
          }
        }
      });
    }

    const self = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!self) throw new NotFoundException('User not found');
    const locked = await this.prisma.templateLock.findMany({ where: { userId: actor.id }, select: { templateId: true } });
    const lockedIds = locked.map((l) => l.templateId);

    const templates = await this.prisma.template.findMany({
      where: { level: self.level, id: { notIn: lockedIds } },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdByAdminId: true,
        items: {
          select: {
            id: true,
            templateId: true,
            assetId: true,
            rebateUnit: true,
            markupPips: true,
            asset: true,
          }
        },
      },
    });

    // Non-admin: ẩn rebateUnit/markupPips riêng lẻ, thay bằng maxPips = tổng
    return templates.map((t) => ({
      ...t,
      items: t.items.map((item) => {
        const { rebateUnit, markupPips, ...rest } = item;
        return { ...rest, maxPips: Number(rebateUnit) + Number(markupPips) };
      }),
    }));
  }

  /**
   * Danh sách tất cả template cùng level với targetUser, kèm trạng thái lock.
   * Actor phải là ADMIN hoặc tổ tiên trong cây của targetUser.
   */
  async listLockStatusForUser(targetUserId: string, actor: RequestActor) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    // Quyền: Admin HOẶC bất kỳ tổ tiên nào trong cây
    if (actor.type !== 'ADMIN') {
      const isAncestor = await this.isAncestorOf(actor.id, targetUserId);
      if (!isAncestor) {
        throw new ForbiddenException('Chỉ Admin hoặc tổ tiên trong cây mới xem được trạng thái lock của user này');
      }
    }

    // Lấy tất cả template cùng level với user
    const templates = await this.prisma.template.findMany({
      where: { level: target.level },
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    // Lấy danh sách lock hiện tại cho user này
    const locks = await this.prisma.templateLock.findMany({
      where: { userId: targetUserId },
      select: { templateId: true },
    });
    const lockedSet = new Set(locks.map((l) => l.templateId));

    return templates.map((t) => ({
      ...t,
      isLocked: lockedSet.has(t.id),
    }));
  }
}
