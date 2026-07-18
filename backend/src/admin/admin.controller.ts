import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../common/guards/admin-only.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard) // mọi route ở đây tối thiểu cần đăng nhập
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('assets')
  @UseGuards(AdminOnlyGuard)
  createAsset(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    return this.adminService.createAsset(dto, user.id);
  }

  @Get('assets')
    // Không cần AdminOnlyGuard — MIB/IB cũng cần đọc danh sách Asset để tạo commission config.
  listAssets() {
    return this.adminService.listAssets();
  }

  @Patch('assets/:id')
  @UseGuards(AdminOnlyGuard)
  updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.adminService.updateAsset(id, dto);
  }

  @Delete('assets/:id')
  @UseGuards(AdminOnlyGuard)
  deleteAsset(@Param('id') id: string) {
    return this.adminService.deleteAsset(id);
  }

  @Post('templates')
  @UseGuards(AdminOnlyGuard)
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.adminService.createTemplate(dto, user.id);
  }

  @Get('templates')
    // Không cần AdminOnlyGuard — MIB/IB cần đọc để "apply template" cho con trực tiếp.
  listTemplates() {
    return this.adminService.listTemplates();
  }

  @Patch('templates/:id')
  @UseGuards(AdminOnlyGuard)
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @UseGuards(AdminOnlyGuard)
  deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id);
  }

  @Post('users')
  @UseGuards(AdminOnlyGuard)
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.adminService.createUser(dto, user.id);
  }
}