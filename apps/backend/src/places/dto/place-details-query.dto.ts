// ========== Imports: ==========
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class PlaceDetailsQueryDto {
    @IsString()
    @IsNotEmpty()
    address!: string;

    @IsOptional()
    @IsNumber()
    lat?: number;

    @IsOptional()
    @IsNumber()
    lon?: number;
}
