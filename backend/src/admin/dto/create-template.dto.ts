import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TemplateItemDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @IsNumber()
  @IsNotEmpty()
  rebateUnit: number;

  @IsNumber()
  @IsNotEmpty()
  markupPips: number;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];
}
