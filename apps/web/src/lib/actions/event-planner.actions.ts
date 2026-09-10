'use server';

// ========== Imports: ==========
import { previewEvent } from '@/lib/api/event-planner';
import type { PreviewEventPayload } from '@/lib/api/event-planner';
import { PredictionUnavailableError } from '@/lib/api/analytics';
import type { PredictionResult } from '@/lib/api/analytics';

export interface EventPreviewResult {
    prediction?:  PredictionResult;
    unavailable?: boolean;
    error?:       string;
}

export async function previewEventAction(
    payload: PreviewEventPayload,
): Promise<EventPreviewResult> {
    try {
        const prediction = await previewEvent(payload);
        return { prediction };
    } catch (err) {
        if (err instanceof PredictionUnavailableError) {
            return { unavailable: true };
        }
        return { error: err instanceof Error ? err.message : 'Kon nie voorspelling laai nie.' };
    }
}
