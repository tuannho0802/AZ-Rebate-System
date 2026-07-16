import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AssetCategory } from '@prisma/client';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;
}
