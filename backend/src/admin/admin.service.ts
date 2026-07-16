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

    // Chỉ chặn khi đổi `code` hoặc `category` — đây là 2 field ảnh hưởng trực tiếp tới
    // logic tính toán (commission config, ledger, payout session dựa vào assetId/category
    // đã chốt). Đổi `name` hoặc `isActive` KHÔNG ảnh hưởng logic tính tiền nên luôn cho phép,
    // kể cả khi asset đã được dùng thật — nếu không, một asset đã dùng 1 lần thì vĩnh viễn
    // không sửa nổi cả lỗi chính tả tên hiển thị.
    const isChangingImmutableFields =
      (dto.code !== undefined && dto.code !== existing.code) ||
      (dto.category !== undefined && dto.category !== existing.category);

    if (isChangingImmutableFields) {
      const isUsed = await this.prisma.$transaction(async (tx) => {
        const configCount = await tx.userCommissionConfig.count({ where: { assetId: id } });
        const payoutCount = await tx.payoutSession.count({ where: { assetId: id } });
        const ledgerCount = await tx.commissionLedger.count({ where: { assetId: id } });
        return { configCount, payoutCount, ledgerCount };
      });

      if (isUsed.configCount > 0 || isUsed.payoutCount > 0 || isUsed.ledgerCount > 0) {
        throw new BadRequestException(
          `Cannot change code/category: asset is referenced by ${isUsed.configCount} configs, ` +
          `${isUsed.payoutCount} payout sessions, and ${isUsed.ledgerCount} ledger entries`
        );
      }

      if (dto.code !== undefined && dto.code !== existing.code) {
        const codeTaken = await this.prisma.asset.findUnique({ where: { code: dto.code } });
        if (codeTaken) {
          throw new BadRequestException('Asset code already exists');
        }
      }
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

    // Kiểm tra ràng buộc dữ liệu THẬT trước khi xoá.
    //
    // LƯU Ý QUAN TRỌNG: KHÔNG tính TemplateItem có giá trị 0/0 vào đây. Mọi Asset khi
    // tạo đều tự động được gắn TemplateItem (0/0) vào MỌI Template hiện có (xem
    // createAsset ở trên) — nếu đếm cả những item mặc định này, deleteAsset sẽ LUÔN bị
    // chặn ngay từ giây đầu tiên asset tồn tại, kể cả khi chưa ai dùng thật (bug đã phát
    // hiện ở bản trước). Chỉ chặn xoá khi có TemplateItem mà Admin đã CHỦ ĐỘNG set giá
    // trị khác 0 (tức dữ liệu thật, xoá sẽ mất thông tin) — hoặc khi có config/payout/
    // ledger tham chiếu, đây là dữ liệu thật 100%.
    const isUsed = await this.prisma.$transaction(async (tx) => {
      const configCount = await tx.userCommissionConfig.count({
        where: { assetId: id },
      });
      const payoutCount = await tx.payoutSession.count({
        where: { assetId: id },
      });
      const meaningfulTemplateItemCount = await tx.templateItem.count({
        where: {
          assetId: id,
          OR: [{ rebateUnit: { not: 0 } }, { markupPips: { not: 0 } }],
        },
      });
      const ledgerCount = await tx.commissionLedger.count({
        where: { assetId: id },
      });
      return { configCount, payoutCount, meaningfulTemplateItemCount, ledgerCount };
    });

    if (
      isUsed.configCount > 0 ||
      isUsed.payoutCount > 0 ||
      isUsed.meaningfulTemplateItemCount > 0 ||
      isUsed.ledgerCount > 0
    ) {
      throw new BadRequestException(
        `Cannot delete asset: referenced by ${isUsed.configCount} configs, ${isUsed.payoutCount} payout sessions, ` +
        `${isUsed.meaningfulTemplateItemCount} template item(s) with non-zero values, and ${isUsed.ledgerCount} ledger entries`
      );
    }

    // Các TemplateItem mặc định 0/0 còn lại (nếu có) sẽ tự bị cascade delete theo schema
    // (onDelete: Cascade), không cần xoá tay.
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

    // Nếu items được cung cấp: UPSERT từng item được gửi lên, KHÔNG xoá sạch rồi tạo lại
    // toàn bộ như bản trước.
    //
    // LÝ DO ĐỔI: cách cũ (deleteMany({}) rồi create([...dto.items, ...missingItems]))
    // nghĩa là nếu frontend chỉ gửi 1 item muốn sửa (ví dụ chỉ sửa GOLD), thì MỌI item
    // khác trong template đó (kể cả những giá trị Admin đã chủ động set trước đó, ví dụ
    // FOREX: 3/3) sẽ bị xoá và tạo lại = 0/0 — mất dữ liệu thật một cách âm thầm.
    //
    // Cách mới: chỉ động vào đúng những asset có trong dto.items; các item khác giữ
    // nguyên. Asset nào (mới thêm sau khi template đã tồn tại) mà chưa có item nào thì
    // vẫn được bổ sung 0/0 để giữ đúng bất biến "mọi Template đủ item cho mọi Asset".
    if (dto.items !== undefined) {
      for (const item of dto.items) {
        if (item.rebateUnit < 0 || item.markupPips < 0) {
          throw new BadRequestException('rebateUnit and markupPips must be non-negative');
        }
      }

      await this.prisma.$transaction(async (tx) => {
        for (const item of dto.items!) {
          await tx.templateItem.upsert({
            where: { templateId_assetId: { templateId: id, assetId: item.assetId } },
            update: {
              rebateUnit: item.rebateUnit,
              markupPips: item.markupPips,
            },
            create: {
              templateId: id,
              assetId: item.assetId,
              rebateUnit: item.rebateUnit,
              markupPips: item.markupPips,
            },
          });
        }

        // Bổ sung 0/0 cho asset nào vẫn chưa có item nào trong template này
        // (ví dụ asset được tạo sau khi template này đã tồn tại và chưa từng PATCH tới).
        const allAssets = await tx.asset.findMany({ select: { id: true } });
        const existingItems = await tx.templateItem.findMany({
          where: { templateId: id },
          select: { assetId: true },
        });
        const existingAssetIds = new Set(existingItems.map((i) => i.assetId));
        const missingItems = allAssets
          .filter((a) => !existingAssetIds.has(a.id))
          .map((a) => ({ templateId: id, assetId: a.id, rebateUnit: 0, markupPips: 0 }));

        if (missingItems.length > 0) {
          await tx.templateItem.createMany({ data: missingItems });
        }
      });

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