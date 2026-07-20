import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min } from 'class-validator';

export class UpsertConfigDto {
  @ApiProperty({ example: 'user-uuid', description: 'ID user' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'asset-uuid', description: 'ID asset' })
  @IsUUID()
  assetId: string;

  @ApiProperty({ example: 10, description: 'Rebate unit (số tiền hoa hồng)' })
  @IsNumber()
  @Min(0)
  rebateUnit: number;

  @ApiProperty({ example: 5, description: 'Markup pips (phần chênh lệch)' })
  @IsNumber()
  @Min(0)
  markupPips: number;
}
