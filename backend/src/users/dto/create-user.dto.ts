import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
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
