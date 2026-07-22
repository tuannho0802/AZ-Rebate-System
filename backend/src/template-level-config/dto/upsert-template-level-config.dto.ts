import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';

export class TemplateLevelConfigItemDto {
  @ApiProperty({ example: 'asset-uuid-1', description: 'ID asset cần cấu hình' })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({ example: 0, description: 'Level tuyệt đối trong cây: 0=MIB, 1=Lv1, ..., 9=Lv9' })
  @IsNumber()
  @Min(0)
  @Max(9)
  level: number;

  @ApiProperty({ example: 2.5, description: 'Rebate own tại level này' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rebateUnit: number;

  @ApiProperty({ example: 1.0, description: 'Markup own tại level này' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  markupPips: number;
}

export class UpsertTemplateLevelConfigDto {
  @ApiProperty({
    type: [TemplateLevelConfigItemDto],
    description: 'Danh sách level config cần create/update cho template kiểu LEVEL',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateLevelConfigItemDto)
  configs: TemplateLevelConfigItemDto[];
}
