import { IsDateString, IsOptional } from 'class-validator';

export class FindMyRsvpsQueryDto {
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;
}