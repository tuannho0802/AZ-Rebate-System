import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TemplateTypeDto {
  ITEM = 'ITEM',
  LEVEL = 'LEVEL',
}

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

  @ApiProperty({
    enum: TemplateTypeDto,
    example: TemplateTypeDto.ITEM,
    description: 'Loại template: ITEM = theo asset, LEVEL = theo asset + level',
  })
  @IsEnum(TemplateTypeDto)
  @IsNotEmpty()
  type: TemplateTypeDto;

  @ApiProperty({ example: 0, description: 'Level áp dụng cho template (0 = MIB, 1 = Lv1 IB...)' })
  @IsNumber()
  @IsNotEmpty()
  level: number;

  @ApiPropertyOptional({
    type: [TemplateItemDto],
    description: 'Danh sách mục template kiểu ITEM. Template kiểu LEVEL không cần field này khi tạo mới.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  @IsOptional()
  items?: TemplateItemDto[];
}
