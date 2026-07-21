import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

@Injectable()
export class TemplateLockService {
  constructor(private readonly prisma: PrismaService) {}

  async lockTemplate(templateId: string, targetUserId: string, actor: RequestActor) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (actor.type !== 'ADMIN' && actor.id !== target.parentId) {
      throw new ForbiddenException('Chỉ Admin hoặc cha trực tiếp mới lock/unlock được template cho user này');
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
    if (actor.type !== 'ADMIN' && actor.id !== target.parentId) {
      throw new ForbiddenException('Chỉ Admin hoặc cha trực tiếp mới lock/unlock được template cho user này');
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

    return this.prisma.template.findMany({
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
        }
      },
    });
  }
}
