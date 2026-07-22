import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AssetCategory } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetDto } from './create-asset.dto';

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @ApiPropertyOptional({ example: 'EUR/USD', description: 'Mã tài sản mới' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'Euro / US Dollar', description: 'Tên tài sản mới' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'FOREX',
    enum: AssetCategory,
    description: 'Danh mục tài sản mới',
  })
  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái kích hoạt' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 10, description: 'Cap Max Rebate' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  capMaxRebate?: number;

  @ApiPropertyOptional({ example: 5, description: 'Cap Max Markup' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  capMaxMarkup?: number;

  @ApiPropertyOptional({ example: 15, description: 'Cap Max Total' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  capMaxTotal?: number;
}
