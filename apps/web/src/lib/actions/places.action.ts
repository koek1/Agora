'use server';

// ========== Imports: ==========
import { searchPlaces, getPlaceDetails } from "../api/places";
import type { PlaceDetails, PlaceSuggestion } from "../api/places";

export interface SearchPlacesResult {
    suggestions?: PlaceSuggestion[];
    error?:      string;
}

export async function searchPlaceAction(input: string): Promise<SearchPlacesResult> {
    try {
        const suggestions = await searchPlaces(input);
        return { suggestions };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie adresse soek nie.'};
    }
}

export interface GetPlaceDetailsResult {
    details?: PlaceDetails;
    error?: string;
}

export async function getPlaceDetailsAction(placeId: string): Promise<GetPlaceDetailsResult> {
    try {
        const details = await getPlaceDetails(placeId);
        return { details };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie adresbesonderhede kry nie.' };
    }
}