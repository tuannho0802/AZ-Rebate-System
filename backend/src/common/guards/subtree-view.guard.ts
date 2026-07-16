import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dung RIENG cho GET /users/:id/subtree — xem TOAN BO cay con (de quy moi cap).
 *
 * Rule (theo xac nhan nghiep vu ngay 16/07/2026, DIEU CHINH LAI cung ngay):
 *   - Admin: xem duoc subtree cua BAT KY user nao trong he thong.
 *   - MIB (root, parentId = null): xem duoc subtree bat dau tu BAT KY user
 *     nao NAM TRONG CAY CUA CHINH MINH (de quy moi cap — con, chau, chat...),
 *     KHONG CHI gioi han o chinh minh. Van khong xem duoc cay cua MIB khac
 *     (branch khac).
 *     [SUA] Ban dau guard nay chi cho phep actor.id === targetUserId, qua
 *     chat qua so voi UI ("MIB bam vao 1 user con de xem cay con cua nguoi
 *     do") — da noi lai thanh kiem tra targetUserId co thuoc subtree cua
 *     actor hay khong, dung lai logic Recursive CTE giong
 *     UsersService.getSubtreeUserIds() de tranh phai import UsersService vao
 *     day (se gay circular dependency giua common/guards va users module).
 *   - IB (khong phai root, du la lv1/lv2/...): KHONG duoc xem subtree cua
 *     BAT KY AI, ke ca chinh minh -> luon 403 (KHONG DOI).
 *
 * LUU Y: guard nay CHU DICH khong dung chung voi UserViewGuard/DirectParentGuard
 * vi ban chat khac nhau (xem-toan-cay vs xem-1-nguoi vs sua-con-truc-tiep).
 * Rule sua tai khoan (PATCH /:id, qua DirectParentGuard) KHONG doi — van chi
 * cha TRUC TIEP moi sua duoc, MIB khong "sua ho" duoc chau/chat.
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

        // Actor la MIB root — cho phep neu targetUserId nam trong subtree cua
        // chinh actor (bao gom ca chinh actor), khong chi gioi han actor.id === targetUserId.
        if (actor.id === targetUserId) {
            return true;
        }

        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "User" WHERE id = ${actor.id}
        UNION ALL
        SELECT u.id
        FROM "User" u
        JOIN subtree s ON u."parentId" = s.id
      )
      SELECT id FROM subtree;
    `;
        const subtreeIds = new Set(rows.map((r) => r.id));

        if (!subtreeIds.has(targetUserId)) {
            throw new ForbiddenException('MIB can only view subtree of users within their own branch');
        }

        return true;
    }
}