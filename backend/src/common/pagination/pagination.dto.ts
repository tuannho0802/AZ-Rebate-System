import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 20;

    // Kept as a plain string (not `keyof any`) — services must whitelist
    // the actual allowed sort fields per-entity before passing to Prisma orderBy.
    @IsOptional()
    @IsString()
    sort?: string = 'createdAt';
}