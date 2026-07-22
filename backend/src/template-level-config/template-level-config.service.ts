import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateType } from '@prisma/client';
import { UpsertTemplateLevelConfigDto } from './dto/upsert-template-level-config.dto';

@Injectable()
export class TemplateLevelConfigService {
  private static readonly EPSILON = 0.0001;

  constructor(private readonly prisma: PrismaService) {}

  private isEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < TemplateLevelConfigService.EPSILON;
  }

  async upsert(templateId: string, dto: UpsertTemplateLevelConfigDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, type: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.type !== TemplateType.LEVEL) {
      throw new BadRequestException('Chỉ template type=LEVEL mới dùng được level-configs');
    }

    if (!dto.configs.length) {
      throw new BadRequestException('Phải gửi ít nhất một level config');
    }

    return this.prisma.$transaction(async (tx) => {
      const totalsByAsset = new Map<string, { rebate: number; markup: number; total: number }>();

      for (const config of dto.configs) {
        const asset = await tx.asset.findUnique({
          where: { id: config.assetId },
          select: { id: true, capMaxRebate: true, capMaxMarkup: true, capMaxTotal: true },
        });

        if (!asset) {
          throw new NotFoundException(`Asset ${config.assetId} not found`);
        }

        if (asset.capMaxRebate === null || asset.capMaxMarkup === null || asset.capMaxTotal === null) {
          throw new BadRequestException(
            `Asset ${config.assetId} chưa có Cap Max. Vui lòng nhập Cap Max Rebate, Cap Max Markup, Cap Max Total trước.`,
          );
        }

        const capMaxRebate = Number(asset.capMaxRebate);
        const capMaxMarkup = Number(asset.capMaxMarkup);
        const capMaxTotal = Number(asset.capMaxTotal);
        const ownTotal = config.rebateUnit + config.markupPips;

        if (config.rebateUnit > capMaxRebate) {
          throw new BadRequestException(`Level config asset ${config.assetId} có rebateUnit vượt capMaxRebate`);
        }
        if (config.markupPips > capMaxMarkup) {
          throw new BadRequestException(`Level config asset ${config.assetId} có markupPips vượt capMaxMarkup`);
        }
        if (ownTotal > capMaxTotal) {
          throw new BadRequestException(`Level config asset ${config.assetId} có tổng rebate+markup vượt capMaxTotal`);
        }

        await tx.templateLevelConfig.upsert({
          where: {
            templateId_level_assetId: {
              templateId,
              level: config.level,
              assetId: config.assetId,
            },
          },
          update: {
            rebateUnit: config.rebateUnit,
            markupPips: config.markupPips,
          },
          create: {
            templateId,
            assetId: config.assetId,
            level: config.level,
            rebateUnit: config.rebateUnit,
            markupPips: config.markupPips,
          },
        });
      }

      const affectedAssetIds = [...new Set(dto.configs.map((config) => config.assetId))];
      const savedConfigs = await tx.templateLevelConfig.findMany({
        where: {
          templateId,
          assetId: { in: affectedAssetIds },
        },
        include: {
          asset: {
            select: {
              id: true,
              code: true,
              name: true,
              capMaxRebate: true,
              capMaxMarkup: true,
              capMaxTotal: true,
            },
          },
        },
      });

      for (const config of savedConfigs) {
        const bucket = totalsByAsset.get(config.assetId) ?? { rebate: 0, markup: 0, total: 0 };
        bucket.rebate += Number(config.rebateUnit);
        bucket.markup += Number(config.markupPips);
        bucket.total += Number(config.rebateUnit) + Number(config.markupPips);
        totalsByAsset.set(config.assetId, bucket);
      }

      for (const assetId of affectedAssetIds) {
        const asset = savedConfigs.find((config) => config.assetId === assetId)?.asset;
        if (!asset) {
          continue;
        }
        const totals = totalsByAsset.get(assetId) ?? { rebate: 0, markup: 0, total: 0 };
        const capMaxRebate = Number(asset.capMaxRebate);
        const capMaxMarkup = Number(asset.capMaxMarkup);
        const capMaxTotal = Number(asset.capMaxTotal);

        if (
          !this.isEqual(totals.rebate, capMaxRebate) ||
          !this.isEqual(totals.markup, capMaxMarkup) ||
          !this.isEqual(totals.total, capMaxTotal)
        ) {
          throw new BadRequestException(
            `Tổng level config của asset ${asset.code} chưa khớp Cap Max: rebate=${totals.rebate}/${capMaxRebate}, markup=${totals.markup}/${capMaxMarkup}, total=${totals.total}/${capMaxTotal}`,
          );
        }
      }

      return tx.template.findUnique({
        where: { id: templateId },
        include: {
          items: {
            include: {
              asset: true,
            },
          },
          levelConfigs: {
            include: {
              asset: true,
            },
            orderBy: [{ assetId: 'asc' }, { level: 'asc' }],
          },
        },
      });
    });
  }
}
