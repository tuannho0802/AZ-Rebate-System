import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Actor shape kỳ vọng từ JWT payload sau khi qua JwtAuthGuard.
 * TODO: đối chiếu với jwt.strategy.ts thật — nếu payload dùng field khác
 * (vd `sub` thay vì `id`, hoặc `role` thay vì `type`), sửa lại type + 2 chỗ
 * đọc actor.id / actor.type bên dưới cho khớp, phần business logic giữ nguyên.
 */
export interface RequestActor {
    id: string;
    type: 'ADMIN' | 'USER';
}

// Whitelist field được phép sort — tránh nhận field tuỳ ý từ query string
// rồi đưa thẳng vào Prisma orderBy (đã note ở review Pagination trước đó).
const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'email', 'fullName', 'role', 'isActive'];

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
    ) { }

    private isAdmin(actor: RequestActor): boolean {
        return actor.type === 'ADMIN';
    }

    private resolveSort(sort?: string): string {
        return sort && ALLOWED_SORT_FIELDS.includes(sort) ? sort : 'createdAt';
    }

    /**
     * Trả về toàn bộ userId trong subtree của `rootId` (bao gồm chính rootId nếu includeSelf=true).
     * Dùng CTE đi XUỐNG (ngược hướng với CTE của PayoutSession — CTE đó đi LÊN từ source tới root).
     */
    private async getSubtreeUserIds(rootId: string, includeSelf: boolean): Promise<string[]> {
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "User" WHERE id = ${rootId}
        UNION ALL
        SELECT u.id
        FROM "User" u
        JOIN subtree s ON u."parentId" = s.id
      )
      SELECT id FROM subtree;
    `;
        const ids = rows.map((r) => r.id);
        return includeSelf ? ids : ids.filter((id) => id !== rootId);
    }

    /**
     * GET /users — Admin thấy toàn bộ; MIB/IB chỉ thấy subtree của chính mình (bao gồm bản thân).
     */
    async findAll(pagination: PaginationDto, actor: RequestActor): Promise<User[]> {
        const { page = 1, limit = 20, sort } = pagination;
        const take = Math.min(limit, 100);
        const skip = (page - 1) * take;
        const orderField = this.resolveSort(sort);

        if (this.isAdmin(actor)) {
            return this.prisma.user.findMany({
                skip,
                take,
                orderBy: { [orderField]: 'desc' },
            });
        }

        const subtreeIds = await this.getSubtreeUserIds(actor.id, true);
        return this.prisma.user.findMany({
            where: { id: { in: subtreeIds } },
            skip,
            take,
            orderBy: { [orderField]: 'desc' },
        });
    }

    /**
     * GET /users/:id — SubtreeGuard đã chặn ở controller nếu actor không phải Admin
     * và :id không nằm trong subtree của actor. Ở đây chỉ cần load + 404 nếu không có.
     */
    async findOne(id: string): Promise<User> {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    /**
     * POST /users — tạo MIB (root) hoặc IB.
     * - dto.parentId undefined => tạo MIB: CHỈ Admin được phép, role bắt buộc = MIB.
     * - dto.parentId có giá trị => tạo IB: Admin HOẶC actor sở hữu subtree chứa parentId
     *   (tức parentId === actor.id, hoặc parentId là hậu duệ của actor).
     */
    async create(dto: CreateUserDto, actor: RequestActor): Promise<User> {
        const isRoot = !dto.parentId;

        if (isRoot) {
            if (!this.isAdmin(actor)) {
                throw new ForbiddenException('Only Admin can create a root MIB account');
            }
            if (dto.role !== Role.MIB) {
                throw new BadRequestException('parentId is empty, so role must be MIB');
            }
        } else {
            if (dto.role !== Role.IB) {
                throw new BadRequestException('parentId is set, so role must be IB');
            }
            const parent = await this.prisma.user.findUnique({ where: { id: dto.parentId } });
            if (!parent) {
                throw new BadRequestException(`parentId ${dto.parentId} does not exist`);
            }
            if (!this.isAdmin(actor)) {
                // actor phải chính là parent, hoặc parent nằm trong subtree của actor
                const ownSubtree = await this.getSubtreeUserIds(actor.id, true);
                if (!ownSubtree.includes(dto.parentId!)) {
                    throw new ForbiddenException('parentId is outside your subtree');
                }
            }
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const created = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                fullName: dto.fullName,
                role: dto.role,
                parentId: dto.parentId ?? null,
                createdByAdminId: this.isAdmin(actor) ? actor.id : null,
            },
        });

        await this.auditLog.createLog({
            actorId: actor.id,
            actorType: actor.type,
            action: 'CREATE_USER',
            entityType: 'User',
            entityId: created.id,
            beforeData: null,
            afterData: created,
        });

        return created;
    }

    /**
     * PATCH /users/:id — chỉ sửa fullName / isActive (no hard delete).
     * SubtreeGuard đã enforce quyền ở controller; ở đây chỉ ghi audit đầy đủ before/after,
     * đặc biệt quan trọng vì isActive ảnh hưởng trực tiếp tới Net-Pips calculation
     * (PayoutSessionService bỏ qua node inactive theo rule 3.5).
     */
    async update(id: string, dto: UpdateUserDto, actor: RequestActor): Promise<User> {
        const before = await this.findOne(id); // ném 404 nếu không tồn tại

        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });

        await this.auditLog.createLog({
            actorId: actor.id,
            actorType: actor.type,
            action: 'UPDATE_USER',
            entityType: 'User',
            entityId: id,
            beforeData: before,
            afterData: updated,
        });

        return updated;
    }

    /**
     * GET /users/:id/subtree — trả về toàn bộ cây con kèm depth, dùng CTE đi xuống.
     * Route phụ trợ cho FE hiển thị cây phân cấp (không bắt buộc theo Plan gốc).
     */
    async getSubtree(id: string): Promise<{ id: string; depth: number }[]> {
        const root = await this.prisma.user.findUnique({ where: { id } });
        if (!root) {
            throw new NotFoundException('User not found');
        }
        return this.prisma.$queryRaw<{ id: string; depth: number }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id, 0 AS depth FROM "User" WHERE id = ${id}
        UNION ALL
        SELECT u.id, s.depth + 1
        FROM "User" u
        JOIN subtree s ON u."parentId" = s.id
      )
      SELECT id, depth FROM subtree ORDER BY depth ASC;
    `;
    }
}