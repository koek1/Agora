// ========== Imports: ==========
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PlacesService } from './places.service';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { PlaceDetailsQueryDto } from './dto/place-details-query.dto';
import { PlaceSuggestionDto } from './dto/place-suggestion.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('places')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class PlacesController {
    constructor(private readonly placesService: PlacesService) {}

    @Get('autocomplete')
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async autocomplete(@Query() query: AutocompleteQueryDto): Promise<PlaceSuggestionDto[]> {
        return this.placesService.autocomplete(query.input);
    }

    @Get('details')
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async details(@Query() query: PlaceDetailsQueryDto): Promise<PlaceDetailsDto> {
        return this.placesService.getDetails(query.address, query.lat, query.lon);
    }
}
