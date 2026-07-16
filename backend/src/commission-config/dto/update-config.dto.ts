import { IsNumber, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsNumber()
  rebateUnit?: number;

  @IsOptional()
  @IsNumber()
  markupPips?: number;

  @IsNumber()
  version: number;
}
