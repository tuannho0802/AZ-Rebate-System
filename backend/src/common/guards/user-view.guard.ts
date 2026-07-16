import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dung cho GET /users/:id — xem thong tin CHI TIET 1 user (khong phai ca subtree).
 *
 * Rule (theo xac nhan nghiep vu ngay 16/07/2026):
 *   - Admin: xem bat ky ai.
 *   - Actor tu xem chinh minh (:id === actor.id): luon duoc phep.
 *   - MIB (root, parentId = null): xem duoc BAT KY AI trong CAY CUA MINH
 *     (de quy moi cap, giong nhu subtree nhung o dang 1 record).
 *   - IB (khong phai root): CHI xem duoc CON TRUC TIEP cua minh (khong xem
 *     duoc chau, khong xem duoc nguoi ngoai nhanh cua minh).
 */
@Injectable()
export class UserViewGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const actor = request.user;

        if (actor.type === 'ADMIN') {
            return true;
        }

        const targetUserId = request.params.id;

        if (actor.id === targetUserId) {
            return true;
        }

        const actorRecord = await this.prisma.user.findUnique({
            where: { id: actor.id },
            select: { parentId: true },
        });
        if (!actorRecord) {
            throw new ForbiddenException('Actor not found');
        }

        const isRoot = actorRecord.parentId === null;

        if (isRoot) {
            // MIB: cho phep xem bat ky ai trong subtree cua minh (de quy, dung
            // lai cung huong CTE nhu SubtreeGuard cu).
            const result = await this.prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE subtree AS (
          SELECT id FROM "User" WHERE "parentId" = ${actor.id}
          UNION ALL
          SELECT u.id FROM "User" u
          INNER JOIN subtree s ON u."parentId" = s.id
        )
        SELECT id FROM subtree WHERE id = ${targetUserId}
        LIMIT 1;
      `;
            if (result.length === 0) {
                throw new ForbiddenException('You do not have permission to view this user');
            }
            return true;
        }

        // IB: chi xem duoc CON TRUC TIEP cua minh, khong duoc nhay cap.
        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { parentId: true },
        });
        if (!target || target.parentId !== actor.id) {
            throw new ForbiddenException('You can only view your direct children');
        }
        return true;
    }
}