// ========== Imports: ==========
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlacesService } from './places.service';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { PlaceDetailsQueryDto } from './dto/place-details-query.dto';
import { PlaceSuggestionDto } from './dto/place-suggestion.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
    constructor(private readonly placesService: PlacesService) {}

    @Get('autocomplete')
    async autocomplete(@Query() query: AutocompleteQueryDto): Promise<PlaceSuggestionDto[]> {
        return this.placesService.autocomplete(query.input);
    }

    @Get('details')
    async details(@Query() query: PlaceDetailsQueryDto): Promise<PlaceDetailsDto> {
        return this.placesService.getDetails(query.address);
    }
}