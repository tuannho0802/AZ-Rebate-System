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

@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('assets')
  createAsset(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    return this.adminService.createAsset(dto, user.id);
  }

  @Get('assets')
  listAssets() {
    return this.adminService.listAssets();
  }

  @Patch('assets/:id')
  updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.adminService.updateAsset(id, dto);
  }

  @Delete('assets/:id')
  deleteAsset(@Param('id') id: string) {
    return this.adminService.deleteAsset(id);
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.adminService.createTemplate(dto, user.id);
  }

  @Get('templates')
  listTemplates() {
    return this.adminService.listTemplates();
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.adminService.createUser(dto, user.id);
  }
}
