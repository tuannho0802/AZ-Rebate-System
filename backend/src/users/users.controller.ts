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

@Controller('users')
@UseGuards(JwtAuthGuard) // mọi route trong controller này đều cần đăng nhập (Admin hoặc User)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * GET /users?page=&limit=&sort=&parentId=
     * Admin: thấy toàn bộ user trong hệ thống.
     * MIB (root): thấy toàn bộ cây của chính mình (đệ quy mọi cấp), không thấy
     * nhánh MIB khác.
     * IB (không phải root): chỉ thấy chính mình + con trực tiếp (không thấy cháu).
     * (Toàn bộ logic filter theo role nằm trong UsersService.findAll(), vì cần
     * phân trang nên không hợp để làm guard.)
     *
     * [SUA — Bug #2 trong handoff]: thêm optional query `parentId` để backend
     * lọc đúng CON TRỰC TIẾP của 1 user, thay vì bắt frontend tự lọc client-side
     * từ 1 trang /users giới hạn (tối đa 100) — cách cũ có thể thiếu con trực
     * tiếp âm thầm nếu subtree/hệ thống có >100 user. Filter này chạy SAU khi
     * đã tính visibleIds theo role trong service, nên không mở rộng thêm phạm
     * vi xem được — chỉ thu hẹp thêm trong đúng phạm vi actor vốn đã được phép
     * xem.
     */
    @Get()
    findAll(
        @Query() pagination: PaginationDto,
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string,
    ) {
        return this.usersService.findAll(pagination, user, parentId);
    }

    /**
     * GET /users/:id
     * Admin: xem bất kỳ user nào.
     * Actor tự xem chính mình: luôn được phép.
     * MIB (root): xem được bất kỳ ai trong cây của mình (đệ quy).
     * IB: chỉ xem được con trực tiếp của mình.
     */
    @Get(':id')
    @UseGuards(UserViewGuard)
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    /**
     * POST /users
     * Tạo MIB mới (parentId = null) HOẶC IB mới (parentId != null).
     * - Tạo MIB: chỉ Admin được phép.
     * - Tạo IB dưới 1 parentId cụ thể: Admin HOẶC actor chính là parentId đó
     *   (chỉ cha trực tiếp mới tạo được con — LvN tạo LvN+1, không "cha hộ"
     *   được cấp thấp hơn). Logic nằm trong UsersService.create().
     */
    @Post()
    create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
        return this.usersService.create(dto, user);
    }

    /**
     * PATCH /users/:id
     * Sửa thông tin user (vd fullName) hoặc toggle isActive.
     * Không hard-delete — chỉ có PATCH, không có DELETE.
     * Rule: chỉ CHA TRỰC TIẾP mới sửa được (LvN sửa LvN+1). Tự sửa chính mình
     * LUÔN bị chặn (403), kể cả MIB. Admin sửa được bất kỳ ai.
     */
    @Patch(':id')
    @UseGuards(DirectParentGuard)
    update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
        // Service phải ghi AuditLog với đầy đủ beforeData/afterData (theo yêu cầu 7.1),
        // đặc biệt quan trọng khi toggle isActive vì ảnh hưởng Net-Pips calculation.
        return this.usersService.update(id, dto, user);
    }

    /**
     * GET /users/:id/subtree
     * Trả về toàn bộ cây con (subtree) của :id — dùng Recursive CTE.
     * Rule: Admin (xem bất kỳ ai) hoặc MIB root xem cây bắt đầu từ BẤT KỲ user
     * nào NẰM TRONG cây của chính mình (đã nới từ "chỉ chính mình" theo yêu cầu
     * ngày 16/07/2026 — xem SubtreeViewGuard).
     */
    @Get(':id/subtree')
    @UseGuards(SubtreeViewGuard)
    getSubtree(@Param('id') id: string) {
        return this.usersService.getSubtree(id);
    }
}