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
     *
     * `tx`: OPTIONAL Prisma transaction client. Pass this whenever createLog()
     * is called from inside another service's $transaction (e.g.
     * CommissionConfigService.upsert() when invoked from TemplateApplyService),
     * otherwise the audit row is written OUTSIDE that transaction and will NOT
     * roll back if a later step in the same transaction fails — leaving an
     * orphan audit log pointing at data that no longer exists.
     */
    async createLog(
        params: CreateAuditLogParams,
        tx?: Prisma.TransactionClient,
    ): Promise<void> {
        const { actorId, actorType, action, entityType, entityId, beforeData, afterData } = params;
        const client = tx ?? this.prisma;

        await client.auditLog.create({
            data: {
                actorAdminId: actorType === 'ADMIN' ? actorId : null,
                actorUserId: actorType === 'USER' ? actorId : null,
                action,
                entityType,
                entityId,
                beforeData: (beforeData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                afterData: (afterData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            },
        });
    }
}