import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserCommissionConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PatchBranchAssetDto } from './dto/patch-branch-asset.dto';

export interface RequestActor {
  id: string;
  type: 'ADMIN' | 'USER';
}

interface BranchRow {
  id: string;
  parentId: string | null;
  email: string;
  fullName: string | null;
  level: number;
  role: string;
  isActive: boolean;
  rebateUnit: string | null;
  markupPips: string | null;
  transferUnit: string | null;
  version: number | null;
}

interface BranchTreeNode {
  userId: string;
  email: string;
  fullName: string | null;
  level: number;
  role: string;
  isActive: boolean;
  rebate: number | null;
  markup: number | null;
  transferUnit: number | null;
  cumulativeRebate: number | null;
  cumulativeMarkup: number | null;
  cumulativeTotal: number | null;
  children: BranchTreeNode[];
}

interface PathSummary {
  pathUserIds: string[];
  pathEmails: string[];
  rebate: number;
  markup: number;
  total: number;
}

export interface RootBranchOverview {
  rootUserId: string;
  rootEmail: string;
  totalUsers: number;
  assetsChecked: number;
  status: 'within' | 'missing' | 'exceeded';
  assetsExceededCount: number;
  assetsMissingConfigCount: number;
}

@Injectable()
export class RebateManagementService {
  private static readonly EPSILON = 0.0001;

  constructor(private readonly prisma: PrismaService) { }

  private isEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < RebateManagementService.EPSILON;
  }

  private async assertAdmin(actor: RequestActor) {
    if (actor.type !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can access rebate management');
    }
  }

  private async getRootUser(rootUserId: string) {
    const rootUser = await this.prisma.user.findUnique({
      where: { id: rootUserId },
      select: { id: true, parentId: true, email: true },
    });

    if (!rootUser) {
      throw new NotFoundException('Root user not found');
    }

    if (rootUser.parentId !== null) {
      throw new BadRequestException('rootUserId phải là MIB gốc (parentId = null)');
    }

    return rootUser;
  }

  private async getAssetOrThrow(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        code: true,
        name: true,
        capMaxRebate: true,
        capMaxMarkup: true,
        capMaxTotal: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (asset.capMaxRebate === null || asset.capMaxMarkup === null || asset.capMaxTotal === null) {
      throw new BadRequestException(
        'Asset chưa có Cap Max. Vui lòng nhập Cap Max Rebate, Cap Max Markup, Cap Max Total trước.',
      );
    }

    return {
      ...asset,
      capMaxRebate: Number(asset.capMaxRebate),
      capMaxMarkup: Number(asset.capMaxMarkup),
      capMaxTotal: Number(asset.capMaxTotal),
    };
  }

  private async getBranchRows(rootUserId: string, assetId: string, tx?: Prisma.TransactionClient): Promise<BranchRow[]> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<BranchRow[]>`
      WITH RECURSIVE subtree AS (
        SELECT
          u.id,
          u."parentId",
          u.email,
          u."fullName",
          u.level,
          u.role,
          u."isActive"
        FROM "User" u
        WHERE u.id = ${rootUserId}
        UNION ALL
        SELECT
          c.id,
          c."parentId",
          c.email,
          c."fullName",
          c.level,
          c.role,
          c."isActive"
        FROM "User" c
        JOIN subtree s ON c."parentId" = s.id
      )
      SELECT
        s.id,
        s."parentId",
        s.email,
        s."fullName",
        s.level,
        s.role,
        s."isActive",
        cfg."rebateUnit",
        cfg."markupPips",
        cfg."transferUnit",
        cfg.version
      FROM subtree s
      LEFT JOIN "UserCommissionConfig" cfg
        ON cfg."userId" = s.id AND cfg."assetId" = ${assetId}
      ORDER BY s.level ASC, s.email ASC;
    `;

    if (!rows.length) {
      throw new NotFoundException('Root user not found');
    }

    return rows;
  }

  private buildTree(rows: BranchRow[]): BranchTreeNode {
    const nodeById = new Map<string, BranchTreeNode>();
    let root: BranchTreeNode | null = null;

    for (const row of rows) {
      const node: BranchTreeNode = {
        userId: row.id,
        email: row.email,
        fullName: row.fullName,
        level: row.level,
        role: row.role,
        isActive: row.isActive,
        rebate: row.rebateUnit === null ? null : Number(row.rebateUnit),
        markup: row.markupPips === null ? null : Number(row.markupPips),
        transferUnit: row.transferUnit === null ? null : Number(row.transferUnit),
        cumulativeRebate: null,
        cumulativeMarkup: null,
        cumulativeTotal: null,
        children: [],
      };
      nodeById.set(row.id, node);
    }

    for (const row of rows) {
      const node = nodeById.get(row.id)!;
      if (row.parentId && nodeById.has(row.parentId)) {
        nodeById.get(row.parentId)!.children.push(node);
      } else if (row.parentId === null) {
        root = node;
      }
    }

    if (!root) {
      throw new NotFoundException('Root user not found');
    }

    this.computePerPathCumulative(root);
    return root;
  }

  private computePerPathCumulative(node: BranchTreeNode): { rebate: number; markup: number; total: number } | null {
    if (node.rebate === null || node.markup === null || node.transferUnit === null) {
      node.cumulativeRebate = null;
      node.cumulativeMarkup = null;
      node.cumulativeTotal = null;
      for (const child of node.children) {
        this.computePerPathCumulative(child);
      }
      return null;
    }

    if (node.children.length === 0) {
      node.cumulativeRebate = node.rebate;
      node.cumulativeMarkup = node.markup;
      node.cumulativeTotal = node.transferUnit;
      return {
        rebate: node.rebate,
        markup: node.markup,
        total: node.transferUnit,
      };
    }

    if (node.children.length > 1) {
      node.cumulativeRebate = null;
      node.cumulativeMarkup = null;
      node.cumulativeTotal = null;
      for (const child of node.children) {
        this.computePerPathCumulative(child);
      }
      return null;
    }

    const childSummary = this.computePerPathCumulative(node.children[0]);
    if (!childSummary) {
      node.cumulativeRebate = null;
      node.cumulativeMarkup = null;
      node.cumulativeTotal = null;
      return null;
    }

    const rebate = node.rebate + childSummary.rebate;
    const markup = node.markup + childSummary.markup;
    const total = node.transferUnit + childSummary.total;
    node.cumulativeRebate = rebate;
    node.cumulativeMarkup = markup;
    node.cumulativeTotal = total;
    return { rebate, markup, total };
  }

  private collectLeafPaths(root: BranchTreeNode): PathSummary[] {
    const paths: PathSummary[] = [];

    const visit = (
      node: BranchTreeNode,
      pathUserIds: string[],
      pathEmails: string[],
      rebate: number,
      markup: number,
      total: number,
    ) => {
      const nextUserIds = [...pathUserIds, node.userId];
      const nextEmails = [...pathEmails, node.email];
      const nextRebate = rebate + (node.rebate ?? 0);
      const nextMarkup = markup + (node.markup ?? 0);
      const nextTotal = total + (node.transferUnit ?? 0);

      if (node.children.length === 0) {
        paths.push({
          pathUserIds: nextUserIds,
          pathEmails: nextEmails,
          rebate: nextRebate,
          markup: nextMarkup,
          total: nextTotal,
        });
        return;
      }

      for (const child of node.children) {
        visit(child, nextUserIds, nextEmails, nextRebate, nextMarkup, nextTotal);
      }
    };

    visit(root, [], [], 0, 0, 0);
    return paths;
  }

  private validatePaths(
    paths: PathSummary[],
    capMax: { capMaxRebate: number; capMaxMarkup: number; capMaxTotal: number },
    touchedUserIds?: Set<string>,
  ) {
    for (const path of paths) {
      if (touchedUserIds && !path.pathUserIds.some((userId) => touchedUserIds.has(userId))) {
        continue;
      }

      const pathLabel = path.pathEmails.join(' -> ');

      if (!this.isEqual(path.rebate, capMax.capMaxRebate)) {
        const diff = Number((path.rebate - capMax.capMaxRebate).toFixed(4));
        throw new BadRequestException(
          `Path ${pathLabel} có rebate=${path.rebate.toFixed(4)}, lệch ${diff.toFixed(4)} so với Cap Max Rebate=${capMax.capMaxRebate.toFixed(4)}`,
        );
      }

      if (!this.isEqual(path.markup, capMax.capMaxMarkup)) {
        const diff = Number((path.markup - capMax.capMaxMarkup).toFixed(4));
        throw new BadRequestException(
          `Path ${pathLabel} có markup=${path.markup.toFixed(4)}, lệch ${diff.toFixed(4)} so với Cap Max Markup=${capMax.capMaxMarkup.toFixed(4)}`,
        );
      }

      if (!this.isEqual(path.total, capMax.capMaxTotal)) {
        const diff = Number((path.total - capMax.capMaxTotal).toFixed(4));
        throw new BadRequestException(
          `Path ${pathLabel} có total=${path.total.toFixed(4)}, lệch ${diff.toFixed(4)} so với Cap Max Total=${capMax.capMaxTotal.toFixed(4)}`,
        );
      }
    }
  }

  private getMissingConfigCount(rows: BranchRow[]) {
    return rows.filter((row) => row.rebateUnit === null || row.markupPips === null || row.transferUnit === null).length;
  }

  private async upsertConfigs(
    tx: Prisma.TransactionClient,
    assetId: string,
    updates: PatchBranchAssetDto['updates'],
  ): Promise<UserCommissionConfig[]> {
    const results: UserCommissionConfig[] = [];

    for (const update of updates) {
      const existing = await tx.userCommissionConfig.findUnique({
        where: { userId_assetId: { userId: update.userId, assetId } },
      });

      const data = {
        rebateUnit: update.rebate,
        markupPips: update.markup,
        transferUnit: update.rebate + update.markup,
        version: existing ? existing.version + 1 : 1,
      };

      const saved = existing
        ? await tx.userCommissionConfig.update({
          where: { userId_assetId: { userId: update.userId, assetId } },
          data,
        })
        : await tx.userCommissionConfig.create({
          data: {
            userId: update.userId,
            assetId,
            ...data,
          },
        });

      results.push(saved);
    }

    return results;
  }

  async getOverview(actor: RequestActor) {
    await this.assertAdmin(actor);

    const [roots, activeAssets] = await Promise.all([
      this.prisma.user.findMany({
        where: { parentId: null },
        select: { id: true, email: true },
        orderBy: { email: 'asc' },
      }),
      this.prisma.asset.findMany({
        where: { isActive: true },
        select: { id: true, capMaxRebate: true, capMaxMarkup: true, capMaxTotal: true },
      }),
    ]);

    const results: RootBranchOverview[] = [];
    for (const root of roots) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE subtree AS (
          SELECT id FROM "User" WHERE id = ${root.id}
          UNION ALL
          SELECT u.id
          FROM "User" u
          JOIN subtree s ON u."parentId" = s.id
        )
        SELECT id FROM subtree;
      `;

      const totalUsers = rows.length;
      let assetsExceededCount = 0;
      let assetsMissingConfigCount = 0;

      for (const asset of activeAssets) {
        if (asset.capMaxRebate === null || asset.capMaxMarkup === null || asset.capMaxTotal === null) {
          assetsMissingConfigCount += 1;
          continue;
        }

        const branchRows = await this.getBranchRows(root.id, asset.id);
        if (this.getMissingConfigCount(branchRows) > 0) {
          assetsMissingConfigCount += 1;
          continue;
        }

        try {
          const tree = this.buildTree(branchRows);
          const paths = this.collectLeafPaths(tree);
          this.validatePaths(paths, {
            capMaxRebate: Number(asset.capMaxRebate),
            capMaxMarkup: Number(asset.capMaxMarkup),
            capMaxTotal: Number(asset.capMaxTotal),
          });
        } catch {
          assetsExceededCount += 1;
        }
      }

      let status: 'within' | 'missing' | 'exceeded' = 'within';
      if (assetsExceededCount > 0) {
        status = 'exceeded';
      } else if (assetsMissingConfigCount > 0) {
        status = 'missing';
      }

      results.push({
        rootUserId: root.id,
        rootEmail: root.email,
        totalUsers,
        assetsChecked: activeAssets.length,
        status,
        assetsExceededCount,
        assetsMissingConfigCount,
      });
    }

    return results;
  }

  async getBranchAsset(rootUserId: string, assetId: string, actor: RequestActor) {
    await this.assertAdmin(actor);
    await this.getRootUser(rootUserId);
    const asset = await this.getAssetOrThrow(assetId);
    const rows = await this.getBranchRows(rootUserId, assetId);
    const root = this.buildTree(rows);

    return {
      asset,
      root,
    };
  }

  async patchBranchAsset(rootUserId: string, assetId: string, dto: PatchBranchAssetDto, actor: RequestActor) {
    await this.assertAdmin(actor);
    await this.getRootUser(rootUserId);
    const asset = await this.getAssetOrThrow(assetId);

    if (!dto.updates.length) {
      throw new BadRequestException('updates không được rỗng');
    }

    const branchRows = await this.getBranchRows(rootUserId, assetId);
    const branchUserIds = new Set(branchRows.map((row) => row.id));
    for (const update of dto.updates) {
      if (!branchUserIds.has(update.userId)) {
        throw new BadRequestException(`userId ${update.userId} không thuộc nhánh ${rootUserId}`);
      }
    }

    const touchedUserIds = new Set(dto.updates.map((update) => update.userId));

    const savedUpdates = await this.prisma.$transaction(async (tx) => {
      const results = await this.upsertConfigs(tx, assetId, dto.updates);
      const nextRows = await this.getBranchRows(rootUserId, assetId, tx);

      if (this.getMissingConfigCount(nextRows) > 0) {
        throw new BadRequestException('Nhánh vẫn còn node thiếu config cho asset này, không thể lưu');
      }

      const tree = this.buildTree(nextRows);
      const paths = this.collectLeafPaths(tree);
      this.validatePaths(paths, asset, touchedUserIds);
      return results;
    });

    return {
      message: 'Cập nhật rebate management thành công',
      updatedCount: savedUpdates.length,
      updates: savedUpdates.map((item) => ({
        userId: item.userId,
        assetId: item.assetId,
        rebate: Number(item.rebateUnit),
        markup: Number(item.markupPips),
        transferUnit: Number(item.transferUnit),
        version: item.version,
      })),
    };
  }
}
