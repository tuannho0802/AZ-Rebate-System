import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface ChainViolation {
    assetCode: string;
    assetId: string;
    childEmail: string;
    childUserId: string;
    parentEmail: string;
    parentUserId: string;
    childRebate: number;
    childMarkup: number;
    parentRebate: number;
    parentMarkup: number;
    childTotal: number;
    parentTotal: number;
    violatesTotal: boolean;
}

@Injectable()
export class IntegrityService {
    private readonly logger = new Logger(IntegrityService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
    ) { }

    /**
     * Quét TOÀN BỘ hệ thống tìm mọi cặp cha-con vi phạm bất biến "tổng con <= tổng cha"
     * (rebateUnit + markupPips), cho MỌI asset. Lớp kiểm tra CHỦ ĐỘNG — không
     * thay thế CHECK constraint DB (vẫn là lưới an toàn cuối), mà để phát hiện
     * SỚM data cũ bị lệch trước khi nó gây lỗi khó hiểu lúc Lock PayoutSession.
     *
     * [SUA — theo phuong an A total-based]: truoc day so sanh PER-FIELD
     * (childRebate > parentRebate HOAC childMarkup > parentMarkup), gay false
     * positive khi Admin remix ty le rebate/markup cua cha (tong khong doi,
     * chi doi mix) — luc do con van hop le (tong con <= tong cha) nhung mot
     * field rieng le co the vuot cha moi. Doi sang so sanh TONG, dung 1 dieu
     * kien duy nhat khop voi rule that su cua he thong.
     */
    async scanChainViolations(actorId: string): Promise<ChainViolation[]> {
        const rows = await this.prisma.$queryRaw<
            Array<{
                assetId: string;
                assetCode: string;
                childUserId: string;
                childEmail: string;
                parentUserId: string;
                parentEmail: string;
                childRebate: string;
                childMarkup: string;
                parentRebate: string;
                parentMarkup: string;
            }>
        >`
      SELECT
        a.id AS "assetId",
        a.code AS "assetCode",
        child_u.id AS "childUserId",
        child_u.email AS "childEmail",
        parent_u.id AS "parentUserId",
        parent_u.email AS "parentEmail",
        child_cfg."rebateUnit" AS "childRebate",
        child_cfg."markupPips" AS "childMarkup",
        COALESCE(parent_cfg."rebateUnit", 0) AS "parentRebate",
        COALESCE(parent_cfg."markupPips", 0) AS "parentMarkup"
      FROM "UserCommissionConfig" child_cfg
      JOIN "User" child_u ON child_u.id = child_cfg."userId"
      JOIN "Asset" a ON a.id = child_cfg."assetId"
      JOIN "User" parent_u ON parent_u.id = child_u."parentId"
      LEFT JOIN "UserCommissionConfig" parent_cfg
        ON parent_cfg."userId" = parent_u.id AND parent_cfg."assetId" = child_cfg."assetId"
      WHERE (child_cfg."rebateUnit" + child_cfg."markupPips")
          > (COALESCE(parent_cfg."rebateUnit", 0) + COALESCE(parent_cfg."markupPips", 0))
      ORDER BY a.code, child_u.email;
    `;

        const violations: ChainViolation[] = rows.map((r) => {
            const childRebate = Number(r.childRebate);
            const childMarkup = Number(r.childMarkup);
            const parentRebate = Number(r.parentRebate);
            const parentMarkup = Number(r.parentMarkup);
            const childTotal = childRebate + childMarkup;
            const parentTotal = parentRebate + parentMarkup;
            return {
                assetCode: r.assetCode,
                assetId: r.assetId,
                childEmail: r.childEmail,
                childUserId: r.childUserId,
                parentEmail: r.parentEmail,
                parentUserId: r.parentUserId,
                childRebate,
                childMarkup,
                parentRebate,
                parentMarkup,
                childTotal,
                parentTotal,
                violatesTotal: childTotal > parentTotal,
            };
        });

        if (violations.length > 0) {
            this.logger.warn(`[INTEGRITY CHECK] Phát hiện ${violations.length} vi phạm chuỗi cha-con:`);
            for (const v of violations) {
                this.logger.warn(
                    `  ${v.assetCode}: ${v.childEmail} total=${v.childTotal} (rebate=${v.childRebate}, markup=${v.childMarkup}) ` +
                    `> cha ${v.parentEmail} total=${v.parentTotal} (rebate=${v.parentRebate}, markup=${v.parentMarkup})`,
                );
            }

            await this.auditLog.createLog({
                actorId,
                actorType: 'ADMIN',
                action: 'INTEGRITY_CHECK_VIOLATIONS_FOUND',
                entityType: 'UserCommissionConfig',
                entityId: 'SYSTEM_SCAN',
                beforeData: null,
                afterData: { violationCount: violations.length, violations },
            });
        } else {
            this.logger.log('[INTEGRITY CHECK] Không phát hiện vi phạm — mọi chuỗi cha-con hợp lệ.');
        }

        return violations;
    }
}