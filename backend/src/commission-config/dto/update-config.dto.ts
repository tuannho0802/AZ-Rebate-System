import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional({ example: 12, description: 'Rebate unit mới' })
  @IsOptional()
  @IsNumber()
  rebateUnit?: number;

  @ApiPropertyOptional({ example: 6, description: 'Markup pips mới' })
  @IsOptional()
  @IsNumber()
  markupPips?: number;

  @ApiProperty({ example: 2, description: 'Version hiện tại (optimistic lock, tăng mỗi lần update)' })
  @IsNumber()
  version: number;
}
