import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min, IsOptional } from 'class-validator';

export class UpsertConfigDto {
  @ApiProperty({ example: 'user-uuid', description: 'ID user' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'asset-uuid', description: 'ID asset' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({ example: 10, description: 'Rebate unit (số tiền hoa hồng)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rebateUnit?: number;

  @ApiPropertyOptional({ example: 5, description: 'Markup pips (phần chênh lệch)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  markupPips?: number;

  @ApiPropertyOptional({ example: 15, description: 'Tổng hoa hồng (Rebate + Markup)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transferUnit?: number;
}
