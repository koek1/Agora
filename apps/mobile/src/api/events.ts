import { apiClient } from './client';

export type EventType = 'public' | 'internal_student' | 'private' | 'department';

export interface EventResponse {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  address: string;
  placeId: string;
  lat: number | null;
  lon: number | null;
  maxCapacity: number;
  budget: number;
  createdBy: string;
  photographers: string[];
  photographerInstructions: string;
  confirmedAttendees: number;
  checkedInCount: number;
  intendedAttendance: string;
  type: EventType;
  sellsTickets: boolean;
  ticketPrice: number | null;
  ticketsAvailable: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPayload {
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  address: string;
  placeId?: string;
  lat?: number;
  lon?: number;
  maxCapacity: number;
  budget?: number;
  photographers?: string[];
  photographerInstructions?: string;
  intendedAttendance?: 'ADMIN' | 'DOSENT' | 'STUDENT' | 'GAS';
  type?: EventType;
  sellsTickets?: boolean;
  ticketPrice?: number;
  ticketsAvailable?: number;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface AssignPhotographerPayload {
  photographerId: string;
  brief: string;
} 

export async function listEvents(from?: string, to?: string): Promise <EventResponse[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<EventResponse[]>(`/events${query}`);
}

export async function getEvent(id: string): Promise<EventResponse> {
  return apiClient.get<EventResponse>(`/events/${id}`);
}

export async function createEvent(payload: CreateEventPayload): Promise<EventResponse> {
  return apiClient.post<EventResponse, CreateEventPayload>('/events', payload);
}

export async function updateEvent(id: string, payload: UpdateEventPayload): Promise <EventResponse> {
  return apiClient.patch<EventResponse, UpdateEventPayload>(`/events/${id}`, payload);
}

export async function deleteEvent(id: string): Promise <void> {
  return apiClient.delete<void>(`/events/${id}`);
}

export async function assignPhotographer(id: string, payload: AssignPhotographerPayload): Promise <EventResponse> {
  return apiClient.patch<EventResponse, AssignPhotographerPayload>(`/events/${id}/assign-photographer`, payload);
}