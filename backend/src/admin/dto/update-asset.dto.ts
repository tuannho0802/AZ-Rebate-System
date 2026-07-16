import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetCategory } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetDto } from './create-asset.dto';

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;

  @IsOptional()
  isActive?: boolean;
}
