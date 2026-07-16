import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dung cho PATCH /users/:id (va bat ky route CRUD nao khac sau nay can cung
 * rule). Rule chung, DONG NHAT cho MOI CAP ke ca MIB (khong co ngoai le nao
 * duoc "quan ly ho" nhieu hon 1 cap):
 *
 *   "LvN chi duoc sua LvN+1 (con TRUC TIEP) cua chinh minh."
 *   Vi du: Alv1 sua duoc Alv2, Alv2 sua duoc Alv3... nhung Alv1 KHONG sua
 *   duoc Alv3 (chau), du Alv3 nam trong subtree cua Alv1.
 *
 *   - Admin: sua bat ky ai.
 *   - Actor tu sua chinh minh: LUON bi chan (403), khong co ngoai le -
 *     ke ca MIB tu sua chinh minh cung bi chan (dong nhat voi rule da
 *     chot ben CommissionConfigModule).
 *   - Actor la CHA TRUC TIEP cua target (target.parentId === actor.id):
 *     duoc phep.
 *   - Con lai (ong/ba, nguoi ngoai nhanh...): 403.
 */
@Injectable()
export class DirectParentGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const actor = request.user;

        if (actor.type === 'ADMIN') {
            return true;
        }

        const targetUserId = request.params.id;

        if (actor.id === targetUserId) {
            throw new ForbiddenException('You cannot edit your own account');
        }

        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { parentId: true },
        });
        if (!target) {
            throw new NotFoundException('User not found');
        }

        if (target.parentId !== actor.id) {
            throw new ForbiddenException('Only the direct parent can edit this user');
        }

        return true;
    }
}