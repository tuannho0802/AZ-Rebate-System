import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreatePayoutSessionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsNumber()
  @Min(0)
  baseVolume: number;

  @IsUUID()
  sourceUserId: string;

  @IsUUID()
  assetId: string;
}
