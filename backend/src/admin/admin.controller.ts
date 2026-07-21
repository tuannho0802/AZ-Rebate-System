import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiOkResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';

@ApiTags('Admin Management')
@UseGuards(JwtAuthGuard) // mọi route ở đây tối thiểu cần đăng nhập
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('assets')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Create asset', description: 'Tạo tài sản mới (chỉ Admin)' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Tài sản được tạo thành công' })
  @ApiForbiddenResponse({ description: 'Người dùng không có quyền Admin' })
  @ApiBadRequestResponse({ description: 'Mã tài sản đã tồn tại' })
  @ApiBody({ type: CreateAssetDto })
  createAsset(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    return this.adminService.createAsset(dto, user.id);
  }

  @Get('assets')
  @ApiOperation({ summary: 'List assets', description: 'Lấy danh sách tất cả tài sản (MIB/IB/Admin đều xem được)' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Danh sách tài sản' })
  listAssets() {
    return this.adminService.listAssets();
  }

  @Patch('assets/:id')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Update asset', description: 'Sửa thông tin tài sản (chỉ Admin, không sửa nếu đang dùng)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID tài sản' })
  @ApiOkResponse({ description: 'Tài sản được cập nhật' })
  @ApiNotFoundResponse({ description: 'Tài sản không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin hoặc tài sản đang được dùng' })
  @ApiBadRequestResponse({ description: 'Tài sản đang được tham chiếu bởi config/payout' })
  @ApiBody({ type: UpdateAssetDto })
  updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.adminService.updateAsset(id, dto);
  }

  @Delete('assets/:id')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Delete asset', description: 'Xóa tài sản (chỉ Admin, không xóa nếu đang dùng)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID tài sản' })
  @ApiOkResponse({ description: 'Tài sản được xóa' })
  @ApiNotFoundResponse({ description: 'Tài sản không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  @ApiBadRequestResponse({ description: 'Tài sản đang được tham chiếu' })
  deleteAsset(@Param('id') id: string) {
    return this.adminService.deleteAsset(id);
  }

  @Post('templates')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Create template', description: 'Tạo template hoa hồng mới (chỉ Admin)' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Template được tạo thành công' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  @ApiBadRequestResponse({ description: 'Tên template đã tồn tại hoặc rebate/markup âm' })
  @ApiBody({ type: CreateTemplateDto })
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return this.adminService.createTemplate(dto, user.id);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List templates', description: 'Lấy danh sách tất cả template (MIB/IB/Admin đều xem được)' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Danh sách template' })
  listTemplates(@CurrentUser() user: any) {
    return this.adminService.listTemplates(user);
  }

  @Patch('templates/:id')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Update template', description: 'Sửa template (chỉ Admin, replace toàn bộ items nếu có)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID template' })
  @ApiOkResponse({ description: 'Template được cập nhật' })
  @ApiNotFoundResponse({ description: 'Template không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  @ApiBadRequestResponse({ description: 'rebate/markup âm' })
  @ApiBody({ type: UpdateTemplateDto })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Delete template', description: 'Xóa template (chỉ Admin, cascade delete items)' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', description: 'ID template' })
  @ApiOkResponse({ description: 'Template được xóa' })
  @ApiNotFoundResponse({ description: 'Template không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id);
  }

  @Post('users')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Create user', description: 'Tạo user mới (Admin)' })
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'User được tạo thành công' })
  @ApiForbiddenResponse({ description: 'Không có quyền Admin' })
  @ApiBadRequestResponse({ description: 'Email đã tồn tại, MIB không có parentId, IB không có parentId' })
  @ApiBody({ type: CreateUserDto })
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.adminService.createUser(dto, user.id);
  }
}
