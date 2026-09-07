'use server';

// ========== Imports: ==========
import { searchPlaces, getPlaceDetails } from '@/lib/api/places';
import type { PlaceSuggestion, PlaceDetails } from '@/lib/api/places';

export interface SearchPlacesResult {
    suggestions?: PlaceSuggestion[];
    error?:       string;
}

export async function searchPlacesAction(input: string): Promise<SearchPlacesResult> {
    try {
        const suggestions = await searchPlaces(input);
        return { suggestions };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie adresse soek nie.' };
    }
}

export interface GetPlaceDetailsResult {
    details?: PlaceDetails;
    error?:   string;
}

export async function getPlaceDetailsAction(address: string): Promise<GetPlaceDetailsResult> {
    try {
        const details = await getPlaceDetails(address);
        return { details };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie adresbesonderhede kry nie.' };
    }
}
