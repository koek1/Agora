// ========== Imports: ==========
import { getToken } from '../session';
import type { AttendanceRole } from '../attendance';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export type EventType = 'public' | 'internal_student' | 'private' | 'department';

export interface Event {
    id:                       string;
    title:                    string;
    description:              string;
    date:                     string;
    endDate?:                 string;
    location:                 string;
    address:                  string;
    placeId:                  string;
    lat:                      number | null;
    lon:                      number | null;
    maxCapacity:              number;
    budget:                   number;
    createdBy:                string;
    photographers:            string[];
    photographerInstructions: string;
    assignedTo:               string | null;
    confirmedAttendees:       number;
    intendedAttendance:       AttendanceRole;
    type:                     EventType;
    sellsTickets:             boolean;
    ticketPrice:              number | null;
    ticketsAvailable:         number | null;
    createdAt:                string;
    updatedAt:                string;
}

export interface CreateEventPayload {
    title:                     string;
    description:               string;
    date:                      string;
    endDate?:                  string;
    location:                  string;
    address:                   string;
    maxCapacity:               number;
    budget?:                   number;
    intendedAttendance?:       AttendanceRole;
    photographers?:            string[];
    photographerInstructions?: string;
    assignedTo?:               string;
    type?:                     EventType;
    sellsTickets?:             boolean;
    ticketPrice?:              number;
    ticketsAvailable?:         number;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface EventFilters {
    from?: string;
    to?:   string;
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
        const body = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg  = body.message ?? res.statusText;
        throw new Error(`[${res.status}] ${typeof msg === 'string' ? msg : msg.join(', ')}`);
    }

    return res.json() as Promise<T>;
}

export async function getEvents(filters?: EventFilters): Promise<Event[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to)   params.set('to',   filters.to);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<Event[]>(`/api/v1/events${query}`);
}

export async function getEventById(id: string): Promise<Event> {
    return apiFetch<Event>(`/api/v1/events/${id}`);
}

export async function createEvent(payload: CreateEventPayload): Promise<Event> {
    return apiFetch<Event>('/api/v1/events', {
        method: 'POST',
        body:   JSON.stringify(payload),
    });
}

export async function updateEvent(id: string, payload: UpdateEventPayload): Promise<Event> {
    return apiFetch<Event>(`/api/v1/events/${id}`, {
        method: 'PATCH',
        body:   JSON.stringify(payload),
    });
}
