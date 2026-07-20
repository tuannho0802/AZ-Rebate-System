import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', description: 'Họ tên mới' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: false, description: 'Trạng thái kích hoạt (toggle soft-delete)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
