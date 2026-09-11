import { IsArray, IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserTitle } from '../../common/enums/user-title.enum';
import { UserTag } from '../../common/enums/user-tag.enum';

/**
 * Slaan validasie oor slegs wanneer die veld heeltemal afwesig is.
 *
 * ValidateIf val null deur na @IsString() en word dit met 'n 400 afgekeur.
 */
const IsPresent = () => ValidateIf((_object, value) => value !== undefined);

// Snoei omliggende spasies voor validasie sodat '   ' as leeg gelees word en
// nie as 'n geldige naam deurglip nie.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateUserDto {

    @IsPresent()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Naam mag nie leeg wees nie' })
    @MaxLength(50, { message: 'Naam mag hoogstens 50 karakters wees' })
    name?: string;

    @IsPresent()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Van mag nie leeg wees nie' })
    @MaxLength(50, { message: 'Van mag hoogstens 50 karakters wees' })
    surname?: string;

    @IsPresent()
    @IsEnum(UserTitle, {
        message: `Titel moet een van die volgende wees: ${Object.values(UserTitle).filter(v => v !== '').join(', ')} of 'n leë string`,
    })
    title?: UserTitle;

    @IsPresent()
    @IsArray()
    @IsEnum(UserTag, { each: true })
    tags?: UserTag[];
}
