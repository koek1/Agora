// ========== Improts: ==========
import { IsDateString, IsInt, Min } from "class-validator";

export class PreviewEventDto {
    @IsDateString()
    date!: string;

    @IsInt()
    @Min(1)
    maxCapacity!: number;
}