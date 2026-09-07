// ========== Imports: ==========
import { IsString, IsNotEmpty } from 'class-validator';

export class PlaceDetailsQueryDto {
    @IsString()
    @IsNotEmpty()
    address!: string;
}
