import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateItemDto } from './create-template.dto';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  @IsOptional()
  items?: TemplateItemDto[];
}
