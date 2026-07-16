import { IsUUID, IsNumber, Min } from 'class-validator';

export class UpsertConfigDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  assetId: string;

  @IsNumber()
  @Min(0)
  rebateUnit: number;

  @IsNumber()
  @Min(0)
  markupPips: number;
}