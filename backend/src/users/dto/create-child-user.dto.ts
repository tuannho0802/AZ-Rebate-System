import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Dùng cho POST /users — IB tự tạo con TRỰC TIẾP cho chính mình (không phải
 * Admin tạo tuỳ ý). Trước đây class này trùng tên "CreateUserDto" với DTO
 * của POST /admin/users (khác thư mục, khác schema) khiến @nestjs/swagger
 * warn "Duplicate DTO detected" — đổi tên thành CreateChildUserDto để tách
 * rõ 2 schema trên OpenAPI doc, không đổi bất kỳ logic validate nào.
 */
export class CreateChildUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email đăng nhập (unique)' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123', description: 'Mật khẩu (tối thiểu 8 ký tự)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Họ tên đầy đủ' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ enum: Role, description: 'Vai trò (MIB hoặc IB)' })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 'parent-uuid', description: 'ID cha (null = MIB root, có giá trị = IB)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}