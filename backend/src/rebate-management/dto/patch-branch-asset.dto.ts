import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class BranchAssetUpdateDto {
  @ApiProperty({ example: 'user-uuid-1', description: 'User trong nhánh cần cập nhật own rebate/markup' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 2.5, description: 'Own rebate mới của user' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rebate: number;

  @ApiProperty({ example: 1.0, description: 'Own markup mới của user' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  markup: number;
}

export class PatchBranchAssetDto {
  @ApiProperty({
    type: [BranchAssetUpdateDto],
    description: 'Danh sách cập nhật own rebate/markup theo user trong nhánh',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchAssetUpdateDto)
  updates: BranchAssetUpdateDto[];
}
