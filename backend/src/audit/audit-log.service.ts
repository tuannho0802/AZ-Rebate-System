import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type AuditActorType = 'ADMIN' | 'USER';

export interface CreateAuditLogParams {
    actorId: string | null;
    actorType: AuditActorType;
    action: string;
    entityType: string;
    entityId: string;
    beforeData?: unknown;
    afterData?: unknown;
}

@Injectable()
export class AuditLogService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Writes a full before/after JSON snapshot for any mutation.
     * actorType decides which FK column (actorAdminId vs actorUserId) is set,
     * matching the AuditLog schema (both are optional/nullable).
     */
    async createLog(params: CreateAuditLogParams): Promise<void> {
        const { actorId, actorType, action, entityType, entityId, beforeData, afterData } = params;

        await this.prisma.auditLog.create({
            data: {
                actorAdminId: actorType === 'ADMIN' ? actorId : null,
                actorUserId: actorType === 'USER' ? actorId : null,
                action,
                entityType,
                entityId,
                // Prisma Json fields need explicit null handling for undefined values
                beforeData: (beforeData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                afterData: (afterData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            },
        });
    }
}