import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateItemDto {
  @ApiProperty({ example: 'asset-uuid-1', description: 'ID tài sản' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ example: 10, description: 'Rebate unit (số tiền hoa hồng)' })
  @IsNumber()
  @IsNotEmpty()
  rebateUnit: number;

  @ApiProperty({ example: 5, description: 'Markup pips (phần chênh lệch)' })
  @IsNumber()
  @IsNotEmpty()
  markupPips: number;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Standard Template', description: 'Tên template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Standard commission template for IB', description: 'Mô tả template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [TemplateItemDto], description: 'Danh sách mục template' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];
}
