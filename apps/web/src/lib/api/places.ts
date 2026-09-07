// ========== Imports: ==========
import { getToken } from "../session";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface PlaceSuggestion {
    placeId:     string;
    description: string;
    lat:         number;
    lon:         number;
}

export interface PlaceDetails {
    placeId: string;
    address: string;
    lat:     number;
    lon:     number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();

    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string | string[]};
        const msg = body.message ?? res.statusText;
        throw new Error(`[${res.status}] ${typeof msg === 'string' ? msg: msg.join(', ')}`);
    }

    return res.json() as Promise<T>;
}

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
    return apiFetch<PlaceSuggestion[]>(`/api/v1/places/autocomplete?input=${encodeURIComponent(input)}`);
}

export async function getPlaceDetails(address: string, lat?: number, lon?: number): Promise<PlaceDetails> {
    const bias = lat !== undefined && lon !== undefined ? `&lat=${lat}&lon=${lon}` : '';
    return apiFetch<PlaceDetails>(`/api/v1/places/details?address=${encodeURIComponent(address)}${bias}`);
}