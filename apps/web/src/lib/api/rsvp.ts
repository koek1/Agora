import { getToken } from '../session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export type RsvpStatus = 'BEVESTIG' | 'HANGENDE' | 'GEKANSELLEER';

// Rou RSVP-dokument soos die backend teruggee
export interface RsvpResponse {
    _id:                     string;
    event:                   string;
    user:                    string;
    status:                  RsvpStatus;
    qrPayload:               string;
    checkedIn:               boolean;
    checkedInAt:             string | null;
    googleCalendarEventId:   string | null;
    outlookCalendarEventId:  string | null;
    createdAt:               string;
    updatedAt:               string;
}

// Soos GET /api/v1/rsvp/my dit terugstuur: 'n rou, gepopuleerde Mongoose-dokument (nie 'n DTO nie)
export interface MyRsvpEvent {
    _id:                 string;
    title:               string;
    description:         string;
    date:                string;
    endDate?:             string;
    location:            string;
    maxCapacity:         number;
    confirmedAttendees:  number;
    type:                string;
    intendedAttendance:  string;
}

export interface MyRsvp {
    _id:         string;
    event:       MyRsvpEvent | null;
    user:        string;
    status:      RsvpStatus;
    qrPayload:   string;
    checkedIn:   boolean;
    checkedInAt: string | null;
    paid:        boolean;
    payment:     string | null;
    createdAt:   string;
    updatedAt:   string;
}

async function throwHttpError(res: Response): Promise<never> {
    const body = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg  = body.message ?? res.statusText;
    throw new Error(`[${res.status}] ${typeof msg === 'string' ? msg : msg.join(', ')}`);
}

// POST /api/v1/rsvp — 409 reeds ingeskryf, 409 vol bespreek, 400 ongeldige eventId
export async function createRsvp(eventId: string): Promise<RsvpResponse> {
    const token = getToken();

    const res = await fetch(`${BASE_URL}/api/v1/rsvp`, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body:  JSON.stringify({ eventId }),
        cache: 'no-store',
    });

    if (!res.ok) await throwHttpError(res);
    return res.json() as Promise<RsvpResponse>;
}

// GET /api/v1/rsvp/my — die ingelogde gebruiker se eie RSVPs, met die geleentheid gepopuleer
export async function getMyRsvps(dateFrom?: string, dateTo?: string): Promise<MyRsvp[]> {
    const token = getToken();
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${BASE_URL}/api/v1/rsvp/my${query}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache:   'no-store',
    });

    if (!res.ok) await throwHttpError(res);
    return res.json() as Promise<MyRsvp[]>;
}

// DELETE /api/v1/rsvp/:id — kanselleer jou eie RSVP (204 No Content)
export async function cancelRsvp(rsvpId: string): Promise<void> {
    const token = getToken();

    const res = await fetch(`${BASE_URL}/api/v1/rsvp/${rsvpId}`, {
        method:  'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache:   'no-store',
    });

    if (!res.ok) await throwHttpError(res);
}

// GET /api/v1/rsvp/:id/qr — PNG-beeld, word server-kant na 'n base64 data-URI omgeskakel
export async function getRsvpQrDataUri(rsvpId: string): Promise<string> {
    const token = getToken();

    const res = await fetch(`${BASE_URL}/api/v1/rsvp/${rsvpId}/qr`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache:   'no-store',
    });

    if (!res.ok) await throwHttpError(res);

    const arrayBuffer = await res.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    return `data:image/png;base64,${base64}`;
}