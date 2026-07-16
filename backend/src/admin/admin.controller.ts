import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
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

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.adminService.createTemplate(dto, user.id);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.adminService.createUser(dto, user.id);
  }
}
