import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreatePayoutSessionDto {
  @ApiProperty({ example: 'Payout July 2026', description: 'Tên payout session' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Monthly payout for July', description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: 1000000, description: 'Base volume (tổng volume giao dịch)' })
  @IsNumber()
  @Min(0)
  baseVolume: number;

  @ApiProperty({ example: 'source-user-uuid', description: 'ID user nguồn (source)' })
  @IsUUID()
  sourceUserId: string;

  @ApiProperty({ example: 'asset-uuid', description: 'ID asset' })
  @IsUUID()
  assetId: string;
}
