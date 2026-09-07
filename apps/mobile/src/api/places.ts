// ========== Imports: ==========
import { apiClient } from './client';

export interface PlaceSuggestion {
    placeId: string;
    description: string;
    lat: number;
    lon: number;
}

export interface PlaceDetails {
    placeId: string;
    address: string;
    lat: number;
    lon: number;
}

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
    return apiClient.get<PlaceSuggestion[]>(`/places/autocomplete?input=${encodeURIComponent(input)}`);
}

export async function getPlaceDetails(address: string, lat?: number, lon?: number): Promise<PlaceDetails> {
    const bias = lat !== undefined && lon !== undefined ? `&lat=${lat}&lon=${lon}` : '';
    return apiClient.get<PlaceDetails>(`/places/details?address=${encodeURIComponent(address)}${bias}`);
}