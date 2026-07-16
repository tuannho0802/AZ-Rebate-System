import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsEnum(Role)
    role: Role;

    // null/undefined => MIB (root). Có giá trị => IB, phải trỏ tới 1 User đang tồn tại.
    // Ràng buộc role khớp parentId (MIB<->null, IB<->not null) được enforce lại ở DB
    // qua CHECK constraint "check_role_parent" (mục 5 spec gốc) — service chỉ cần
    // đảm bảo request hợp lệ, DB sẽ chặn lần cuối nếu có sai sót.
    @IsOptional()
    @IsUUID()
    parentId?: string;
}