import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Dùng cho POST /admin/users — Admin tạo user bất kỳ (MIB root hoặc IB, có
 * thể chỉ định parentId tuỳ ý trong giới hạn nghiệp vụ ở admin.service.ts).
 * KHÔNG dùng chung với DTO của POST /users (IB tự tạo con trực tiếp) — xem
 * CreateChildUserDto ở users/dto/create-user.dto.ts, đã đổi tên để tránh
 * trùng tên class "CreateUserDto" gây warning "Duplicate DTO detected" từ
 * @nestjs/swagger.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email đăng nhập (unique)' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'securepass', description: 'Mật khẩu (tối thiểu 6 ký tự)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Họ tên đầy đủ' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ enum: Role, description: 'Vai trò (MIB hoặc IB)' })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ example: 'parent-uuid', description: 'ID cha (bỏ trống = MIB root, có giá trị = IB)' })
  @IsString()
  @IsOptional()
  parentId?: string;
}