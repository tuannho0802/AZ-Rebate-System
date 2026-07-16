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
import { SubtreeGuard } from '../common/guards/subtree.guard';
// Lưu ý: AdminOnlyGuard KHÔNG dùng ở controller này có chủ đích — logic phân biệt
// "tạo MIB (root) chỉ Admin" vs "tạo IB thì Admin hoặc chủ subtree" nằm trong
// UsersService.create(), vì Guard cấp controller không biết trước dto.parentId
// có null hay không (xem comment ở route POST bên dưới).
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
     * MIB/IB: chỉ thấy user trong subtree của chính mình (enforce ở service,
     * dựa vào actor lấy từ request — SubtreeGuard áp cho route xem 1 userId cụ thể,
     * còn route list này service tự filter theo actor).
     */
    @Get()
    findAll(@Query() pagination: PaginationDto, @CurrentUser() user: any) {
        // TODO: đối chiếu tên method thật trong UsersService — giả định findAll(pagination, actor)
        return this.usersService.findAll(pagination, user);
    }

    /**
     * GET /users/:id
     * Admin: xem bất kỳ user nào.
     * MIB/IB: chỉ xem được nếu :id nằm trong subtree của mình (SubtreeGuard chặn trước
     * khi vào tới đây, bỏ qua guard này nếu actor là Admin).
     */
    @Get(':id')
    @UseGuards(SubtreeGuard)
    findOne(@Param('id') id: string) {
        // TODO: đối chiếu tên method thật — giả định findOne(id)
        return this.usersService.findOne(id);
    }

    /**
     * POST /users
     * Tạo MIB mới (parentId = null) HOẶC IB mới (parentId != null).
     * - Tạo MIB: chỉ Admin được phép (AdminOnlyGuard).
     * - Tạo IB dưới 1 parentId cụ thể: Admin hoặc MIB/IB sở hữu subtree chứa parentId đó.
     *   Việc phân biệt 2 case này nên xử lý trong service (dựa vào dto.parentId có null
     *   hay không), vì Guard cấp controller không thể tự biết trước body chứa gì.
     *   AdminOnlyGuard ở đây chỉ chặn cứng nếu bạn muốn MỌI việc tạo user đều qua Admin —
     *   xác nhận lại nghiệp vụ thật trước khi bật guard này, vì Plan gốc cho phép
     *   MIB/IB tự tạo IB con trong subtree của mình mà không cần Admin.
     */
    @Post()
    create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
        // TODO: đối chiếu tên method thật — giả định create(dto, actor), service tự
        // quyết định: nếu dto.parentId == null -> bắt buộc actor phải là Admin (403 nếu không),
        // nếu dto.parentId != null -> actor phải là Admin hoặc user sở hữu subtree chứa parentId.
        return this.usersService.create(dto, user);
    }

    /**
     * PATCH /users/:id
     * Sửa thông tin user (vd fullName) hoặc toggle isActive.
     * Không hard-delete (theo CONFLICTS #4 gốc) — chỉ có PATCH, không có DELETE.
     * SubtreeGuard: Admin bỏ qua, MIB/IB chỉ sửa được user trong subtree của mình.
     */
    @Patch(':id')
    @UseGuards(SubtreeGuard)
    update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
        // TODO: đối chiếu tên method thật — giả định update(id, dto, actor)
        // Service phải ghi AuditLog với đầy đủ beforeData/afterData (theo yêu cầu 7.1),
        // đặc biệt quan trọng khi toggle isActive vì ảnh hưởng Net-Pips calculation.
        return this.usersService.update(id, dto, user);
    }

    /**
     * GET /users/:id/subtree
     * Trả về toàn bộ cây con (subtree) của :id — dùng Recursive CTE.
     * Tiện cho FE hiển thị cây phân cấp. Không bắt buộc theo Plan gốc nhưng hữu ích
     * để verify SubtreeGuard hoạt động đúng khi test thủ công.
     */
    @Get(':id/subtree')
    @UseGuards(SubtreeGuard)
    getSubtree(@Param('id') id: string) {
        // TODO: đối chiếu tên method thật — giả định getSubtree(id)
        // Nếu service chưa có method này, có thể bỏ route này đi, không bắt buộc.
        return this.usersService.getSubtree(id);
    }
}