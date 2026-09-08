// ========== Imports: ==========
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AutocompleteQueryDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    input!: string;
}
