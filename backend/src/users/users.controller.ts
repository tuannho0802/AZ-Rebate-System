import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserViewGuard } from '../common/guards/user-view.guard';
import { DirectParentGuard } from '../common/guards/direct-parent.guard';
import { SubtreeViewGuard } from '../common/guards/subtree-view.guard';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiOkResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';

@ApiTags('User Management')
@Controller('users')
@UseGuards(JwtAuthGuard) // mọi route trong controller này đều cần đăng nhập (Admin hoặc User)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @ApiOperation({ summary: 'List users', description: 'Lấy danh sách user theo role (Admin: toàn bộ; MIB: subtree riêng; IB: mình + con trực tiếp)' })
    @ApiBearerAuth('access-token')
    @ApiQuery({ name: 'page', required: false, example: 1, description: 'Trang' })
    @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Số bản ghi mỗi trang' })
    @ApiQuery({ name: 'sort', required: false, example: 'createdAt', description: 'Trường sắp xếp' })
    @ApiQuery({ name: 'parentId', required: false, description: 'Lọc con trực tiếp của user này (Admin/MIB/IB)' })
    @ApiOkResponse({ description: 'Danh sách user' })
    findAll(
        @Query() pagination: PaginationDto,
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string,
    ) {
        return this.usersService.findAll(pagination, user, parentId);
    }

    @Get(':id')
    @UseGuards(UserViewGuard)
    @ApiOperation({ summary: 'Get user by ID', description: 'Xem thông tin user cụ thể (Admin: bất kỳ; MIB: subtree; IB: con trực tiếp)' })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID user' })
    @ApiOkResponse({ description: 'Thông tin user' })
    @ApiNotFoundResponse({ description: 'User không tồn tại' })
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create user', description: 'Tạo MIB (root) hoặc IB (dưới parentId)' })
    @ApiBearerAuth('access-token')
    @ApiCreatedResponse({ description: 'User được tạo thành công' })
    @ApiBadRequestResponse({ description: 'Email đã tồn tại, parentId không hợp lệ, role không đúng' })
    @ApiForbiddenResponse({ description: 'Không phải Admin nhưng cố tạo MIB hoặc tạo IB dưới cha không phải mình' })
    @ApiBody({ type: CreateUserDto })
    create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
        return this.usersService.create(dto, user);
    }

    @Patch(':id')
    @UseGuards(DirectParentGuard)
    @ApiOperation({ summary: 'Update user', description: 'Sửa fullName/isActive (chỉ cha trực tiếp, không sửa email/role/parentId)' })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID user' })
    @ApiOkResponse({ description: 'User được cập nhật' })
    @ApiForbiddenResponse({ description: 'Không phải cha trực tiếp hoặc tự sửa chính mình' })
    @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
    @ApiBody({ type: UpdateUserDto })
    update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
        return this.usersService.update(id, dto, user);
    }

    @Get(':id/subtree')
    @UseGuards(SubtreeViewGuard)
    @ApiOperation({ summary: 'Get user subtree', description: 'Lấy toàn bộ cây con (recursive) của user (Admin: bất kỳ; MIB: chỉ cây riêng mình)' })
    @ApiBearerAuth('access-token')
    @ApiParam({ name: 'id', description: 'ID user root' })
    @ApiOkResponse({ description: 'Danh sách subtree kèm depth' })
    @ApiNotFoundResponse({ description: 'User không tồn tại' })
    @ApiForbiddenResponse({ description: 'Không có quyền xem subtree (IB luôn 403)' })
    getSubtree(@Param('id') id: string) {
        return this.usersService.getSubtree(id);
    }
}
