import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dung RIENG cho GET /users/:id/subtree — xem TOAN BO cay con (de quy moi cap).
 *
 * Rule (theo xac nhan nghiep vu ngay 16/07/2026):
 *   - Admin: xem duoc subtree cua BAT KY user nao trong he thong.
 *   - MIB (root, parentId = null): CHI xem duoc subtree cua CHINH MINH
 *     (khong co ngoai le nao khac — khong xem duoc cay cua MIB khac).
 *   - IB (khong phai root, du la lv1/lv2/...): KHONG duoc xem subtree cua
 *     BAT KY AI, ke ca chinh minh -> luon 403.
 *
 * LUU Y: guard nay CHU DICH khong dung chung voi UserViewGuard/DirectParentGuard
 * vi ban chat khac nhau (xem-toan-cay vs xem-1-nguoi vs sua-con-truc-tiep).
 */
@Injectable()
export class SubtreeViewGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const actor = request.user;

        if (actor.type === 'ADMIN') {
            return true;
        }

        const targetUserId = request.params.id;

        const actorRecord = await this.prisma.user.findUnique({
            where: { id: actor.id },
            select: { parentId: true },
        });
        if (!actorRecord) {
            throw new ForbiddenException('Actor not found');
        }

        const isRoot = actorRecord.parentId === null;
        if (!isRoot) {
            throw new ForbiddenException('Only Admin or a root MIB can view a full subtree');
        }

        if (actor.id !== targetUserId) {
            throw new ForbiddenException('MIB can only view their own subtree, not another branch');
        }

        return true;
    }
}