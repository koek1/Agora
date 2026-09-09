// ========== Imports: ==========
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaceSuggestionDto } from './dto/place-suggestion.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';

interface GeoapifyAutocompleteResult {
    place_id: string;
    formatted: string;
    lat: number;
    lon: number;
}

interface GeoapifyAutocompleteResponse {
    results: GeoapifyAutocompleteResult[];
}

interface GeoapifySearchResult {
    place_id:  string;
    formatted?: string;
    lat?:       number;
    lon?:       number;
}

interface GeoapifySearchResponse {
    results: GeoapifySearchResult[];
}

@Injectable()
export class PlacesService {
    constructor(private readonly configService: ConfigService) {}

    async autocomplete(input: string): Promise<PlaceSuggestionDto[]> {
        const apiKey = this.configService.get<string>('geoapify.apiKey');
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(input)}&format=json&apiKey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new BadRequestException('Kon nie tans adresse soek nie, probeer asseblief weer');
        }
        const data = await response.json() as GeoapifyAutocompleteResponse;

        return data.results.map((result) => ({
            placeId: result.place_id,
            description: result.formatted,
            lat: result.lat,
            lon: result.lon,
        }));
    }

    async getDetails(address: string, lat?: number, lon?: number): Promise<PlaceDetailsDto> {
        const apiKey = this.configService.get<string>('geoapify.apiKey');
        const bias = lat !== undefined && lon !== undefined ? `&bias=proximity:${lon},${lat}` : '';
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&format=json${bias}&apiKey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new BadRequestException('Kon nie tans die adres verifieer nie, probeer asseblief weer');
        }
        const data = await response.json() as GeoapifySearchResponse;

        const result = data.results[0];
        if (!result?.formatted || result.lat === undefined || result.lon === undefined) {
            throw new BadRequestException('Kon nie ‘n geldige adres vir hierdie plek vind nie');
        }

        return {
            placeId: result.place_id,
            address: result.formatted,
            lat: result.lat,
            lon: result.lon,
        };
    }
}
