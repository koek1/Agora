// ========== Imports: ==========
import { getToken } from '../session';
import { PredictionUnavailableError } from './analytics';
import type { PredictionResult } from './analytics';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface PreviewEventPayload {
    date:        string;
    maxCapacity: number;
}

export async function previewEvent(payload: PreviewEventPayload): Promise<PredictionResult> {
    const token = getToken();

    const res = await fetch(`${BASE_URL}/api/v1/event-planner/preview`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    if (res.status === 503) {
        throw new PredictionUnavailableError('Prediction service unavailable');
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg  = body.message ?? res.statusText;
        throw new Error(`[${res.status}] ${typeof msg === 'string' ? msg : msg.join(', ')}`);
    }

    return res.json() as Promise<PredictionResult>;
}
