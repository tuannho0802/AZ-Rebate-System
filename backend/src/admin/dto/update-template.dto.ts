import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateItemDto } from './create-template.dto';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @ApiPropertyOptional({ example: 'Standard Template', description: 'Tên template mới' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Standard commission template for IB', description: 'Mô tả template mới' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [TemplateItemDto], description: 'Danh sách mục template mới (replace toàn bộ items cũ)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  @IsOptional()
  items?: TemplateItemDto[];
}
