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
// [DA SUA 16/07/2026] SubtreeGuard cu (cho phep tu xem + xem toan bo cay con
// chau cho MOI route) da bi thay the boi 3 guard rieng biet, vi 3 route nay
// co ban chat quyen khac nhau theo rule moi:
//   - GET /:id           -> UserViewGuard    (MIB: full cay minh; IB: chi con truc tiep)
//   - PATCH /:id         -> DirectParentGuard (chi cha TRUC TIEP moi sua duoc, tu sua = 403)
//   - GET /:id/subtree   -> SubtreeViewGuard  (CHI Admin + MIB(chinh minh); IB luon 403)
// AdminOnlyGuard van KHONG dung o route POST vi ly do cu: logic phan biet
// "tao MIB (root) chi Admin" vs "tao IB thi Admin hoac CHA TRUC TIEP" nam
// trong UsersService.create() (da siet lai thanh "chi cha truc tiep", xem
// comment trong service).
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
     * GET /users?page=&limit=&sort=
     * Admin: thấy toàn bộ user trong hệ thống.
     * MIB (root): thấy toàn bộ cây của chính mình (đệ quy mọi cấp), không thấy
     * nhánh MIB khác.
     * IB (không phải root): chỉ thấy chính mình + con trực tiếp (không thấy cháu).
     * (Toàn bộ logic filter theo role nằm trong UsersService.findAll(), vì cần
     * phân trang nên không hợp để làm guard.)
     */
    @Get()
    findAll(@Query() pagination: PaginationDto, @CurrentUser() user: any) {
        return this.usersService.findAll(pagination, user);
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
     * Rule: CHỈ Admin (xem bất kỳ ai) hoặc MIB root xem CHÍNH cây của mình.
     * IB không được xem subtree của bất kỳ ai, kể cả chính mình.
     */
    @Get(':id/subtree')
    @UseGuards(SubtreeViewGuard)
    getSubtree(@Param('id') id: string) {
        return this.usersService.getSubtree(id);
    }
}