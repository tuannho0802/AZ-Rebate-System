import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    // Toggle soft-delete (CONFLICTS #4 gốc): không hard-delete, chỉ set isActive.
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    // Không cho sửa email/role/parentId ở đây:
    // - email: tránh phá vỡ định danh đăng nhập
    // - role/parentId: reparent chưa được implement ở Phase 3 (CONFLICTS #3 gốc —
    //   "chưa triển khai ở phase này", cần re-validate toàn bộ subtree nếu làm sau)
}