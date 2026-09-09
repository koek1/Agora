'use server';

import { cancelRsvp, createRsvp, getMyRsvps, getRsvpQrDataUri } from '@/lib/api/rsvp';
import type { MyRsvp } from '@/lib/api/rsvp';

export interface RsvpActionResult {
    qrDataUri?:        string;
    syncedToGoogle?:   boolean;
    syncedToOutlook?:  boolean;
    error?:            string;
}

export async function rsvpToEventAction(eventId: string): Promise<RsvpActionResult> {
    try {
        const rsvp      = await createRsvp(eventId);
        const qrDataUri = await getRsvpQrDataUri(rsvp._id);
        return {
            qrDataUri,
            syncedToGoogle:  rsvp.googleCalendarEventId  !== null,
            syncedToOutlook: rsvp.outlookCalendarEventId !== null,
        };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Inskrywing het misluk.' };
    }
}

export async function getRsvpQrAction(rsvpId: string): Promise<RsvpActionResult> {
    try {
        const qrDataUri = await getRsvpQrDataUri(rsvpId);
        return { qrDataUri };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie die QR-kode laai nie.' };
    }
}

export interface CancelRsvpResult {
    error?: string;
}

export async function cancelRsvpAction(rsvpId: string): Promise<CancelRsvpResult> {
    try {
        await cancelRsvp(rsvpId);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie die RSVP kanselleer nie.' };
    }
}

export interface GetMyRsvpsResult {
    rsvps?: MyRsvp[];
    error?:  string;
}

export async function getMyRsvpsAction(dateFrom?: string, dateTo?: string): Promise<GetMyRsvpsResult> {
    try {
        const rsvps = await getMyRsvps(dateFrom, dateTo);
        return { rsvps };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Kon nie jou RSVPs laai nie.' };
    }
}