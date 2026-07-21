import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional({ example: 12, description: 'Rebate unit mới' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rebateUnit?: number;

  @ApiPropertyOptional({ example: 6, description: 'Markup pips mới' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  markupPips?: number;

  @ApiPropertyOptional({ example: 18, description: 'Tổng hoa hồng mới (Rebate + Markup)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transferUnit?: number;

  @ApiProperty({ example: 2, description: 'Version hiện tại (optimistic lock, tăng mỗi lần update)' })
  @IsNumber()
  version: number;
}
