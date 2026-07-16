import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) { }

  async createAsset(dto: CreateAssetDto, adminId: string) {
    const existing = await this.prisma.asset.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException('Asset code already exists');
    }

    // Tạo Asset + đồng bộ TemplateItem cho MỌI Template hiện có trong 1 transaction
    // duy nhất — đảm bảo bất biến "mọi Template luôn đủ item cho mọi Asset" không
    // bao giờ bị vi phạm, kể cả khi có lỗi giữa chừng (rollback toàn bộ).
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          ...dto,
          createdByAdminId: adminId,
        },
      });

      const templates = await tx.template.findMany({ select: { id: true } });
      if (templates.length > 0) {
        // Asset vừa tạo mới toanh -> chắc chắn chưa có item nào ở bất kỳ Template
        // nào, dùng createMany thẳng, không cần upsert.
        await tx.templateItem.createMany({
          data: templates.map((t) => ({
            templateId: t.id,
            assetId: asset.id,
            rebateUnit: 0,
            markupPips: 0,
          })),
        });
      }

      return asset;
    });
  }

  async listAssets() {
    return this.prisma.asset.findMany({
      include: {
        templateItems: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAsset(id: string, dto: UpdateAssetDto) {
    const existing = await this.prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    // Kiểm tra nếu asset đang được dùng trong commission configs hoặc payout sessions
    const isUsed = await this.prisma.$transaction(async (tx) => {
      const configCount = await tx.userCommissionConfig.count({
        where: { assetId: id },
      });
      const payoutCount = await tx.payoutSession.count({
        where: { assetId: id },
      });
      return { configCount, payoutCount };
    });

    if (isUsed.configCount > 0 || isUsed.payoutCount > 0) {
      throw new BadRequestException(
        `Cannot update asset: referenced by ${isUsed.configCount} configs and ${isUsed.payoutCount} payout sessions`
      );
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteAsset(id: string) {
    const existing = await this.prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    // Kiểm tra ràng buộc khoá ngoại trước khi xoá
    const isUsed = await this.prisma.$transaction(async (tx) => {
      const configCount = await tx.userCommissionConfig.count({
        where: { assetId: id },
      });
      const payoutCount = await tx.payoutSession.count({
        where: { assetId: id },
      });
      const templateItemCount = await tx.templateItem.count({
        where: { assetId: id },
      });
      const ledgerCount = await tx.commissionLedger.count({
        where: { assetId: id },
      });
      return { configCount, payoutCount, templateItemCount, ledgerCount };
    });

    if (isUsed.configCount > 0 || isUsed.payoutCount > 0 || isUsed.templateItemCount > 0 || isUsed.ledgerCount > 0) {
      throw new BadRequestException(
        `Cannot delete asset: referenced by ${isUsed.configCount} configs, ${isUsed.payoutCount} payout sessions, ${isUsed.templateItemCount} template items, and ${isUsed.ledgerCount} ledger entries`
      );
    }

    return this.prisma.asset.delete({ where: { id } });
  }

  async createTemplate(dto: CreateTemplateDto, adminId: string) {
    const existing = await this.prisma.template.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException('Template name already exists');
    }

    // validate if all items have non-negative rebateUnit and markupPips
    for (const item of dto.items) {
      if (item.rebateUnit < 0 || item.markupPips < 0) {
        throw new BadRequestException('rebateUnit and markupPips must be non-negative');
      }
    }

    // Đảm bảo Template mới tạo có đủ item cho MỌI Asset hiện có trong DB.
    // Asset nào Admin không liệt kê trong dto.items sẽ tự động = 0.
    const allAssets = await this.prisma.asset.findMany({ select: { id: true } });
    const providedAssetIds = new Set(dto.items.map((i) => i.assetId));
    const missingItems = allAssets
      .filter((a) => !providedAssetIds.has(a.id))
      .map((a) => ({ assetId: a.id, rebateUnit: 0, markupPips: 0 }));

    return this.prisma.template.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdByAdminId: adminId,
        items: {
          create: [...dto.items, ...missingItems],
        },
      },
      include: {
        items: true,
      },
    });
  }

  async listTemplates() {
    return this.prisma.template.findMany({
      include: {
        items: {
          include: {
            asset: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.template.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    // Nếu items được cung cấp, replace toàn bộ items cũ
    if (dto.items !== undefined) {
      // validate if all items have non-negative rebateUnit and markupPips
      for (const item of dto.items) {
        if (item.rebateUnit < 0 || item.markupPips < 0) {
          throw new BadRequestException('rebateUnit and markupPips must be non-negative');
        }
      }

      const allAssets = await this.prisma.asset.findMany({ select: { id: true } });
      const providedAssetIds = new Set(dto.items.map((i) => i.assetId));
      const missingItems = allAssets
        .filter((a) => !providedAssetIds.has(a.id))
        .map((a) => ({ assetId: a.id, rebateUnit: 0, markupPips: 0 }));

      return this.prisma.template.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          items: {
            deleteMany: {},
            create: [...dto.items, ...missingItems],
          },
        },
        include: {
          items: {
            include: {
              asset: true,
            },
          },
        },
      });
    }

    // Nếu chỉ update metadata, không chạm items
    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        items: {
          include: {
            asset: true,
          },
        },
      },
    });
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.template.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    // TemplateItem sẽ bị cascade delete khi template bị delete
    return this.prisma.template.delete({
      where: { id },
    });
  }

  async createUser(dto: CreateUserDto, adminId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('User email already exists');
    }

    if (dto.role === Role.MIB && dto.parentId) {
      throw new BadRequestException('MIB cannot have a parent');
    }

    if (dto.role === Role.IB && !dto.parentId) {
      throw new BadRequestException('IB must have a parent');
    }

    if (dto.parentId) {
      const parent = await this.prisma.user.findUnique({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException('Parent not found');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        parentId: dto.parentId,
        createdByAdminId: adminId,
      },
    });
  }
}
