import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createAsset(dto: CreateAssetDto, adminId: string) {
    const existing = await this.prisma.asset.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException('Asset code already exists');
    }
    return this.prisma.asset.create({
      data: {
        ...dto,
        createdByAdminId: adminId,
      },
    });
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

    return this.prisma.template.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdByAdminId: adminId,
        items: {
          create: dto.items,
        },
      },
      include: {
        items: true,
      },
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
