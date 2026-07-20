import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AssetCategory } from '@prisma/client';

export class CreateAssetDto {
  @ApiProperty({ example: 'EUR/USD', description: 'Mã tài sản (unique)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Euro / US Dollar', description: 'Tên tài sản' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'FOREX',
    enum: AssetCategory,
    description: 'Danh mục tài sản',
  })
  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;
}
