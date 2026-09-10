// ========== Imports: ==========
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { EventDocument } from '../../events/schemas/event.schema';
import { CalendarConnection } from '../../users/schemas/calendar-connection.schema';

export interface GoogleTokenResult {
    accessToken: string;
    refreshToken: string | null;
    expiryDate: Date | null;
    accountEmail: string;
}

export interface GoogleEventSyncResult {
    externalEventId: string;
    refreshedAccessToken: string | null;
    refreshedExpiryDate: Date | null;
}

interface GoogleUserinfoResponse {
    email?: string;
}

interface GoogleCalendarEventResponse {
    id: string;
}

interface FreshAccessToken {
    accessToken: string;
    refreshedAccessToken: string | null;
    refreshedExpiryDate: Date | null;
}

const CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
];

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

@Injectable()
export class GoogleCalendarService {
    private readonly logger = new Logger(GoogleCalendarService.name);

    constructor(private readonly config: ConfigService) {}

    buildAuthUrl(state: string): string {
        const client = this.createOAuthClient();
        return client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'select_account consent',
            scope: CALENDAR_SCOPES,
            state,
        });
    }

    async exchangeCode(code: string): Promise<GoogleTokenResult> {
        const client = this.createOAuthClient();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        const response = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userinfo = (await response.json()) as GoogleUserinfoResponse;

        return {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token ?? null,
            expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            accountEmail: userinfo.email ?? '',
        };
    }

    async createEvent(connection: CalendarConnection, event: EventDocument): Promise<GoogleEventSyncResult> {
        const { accessToken, refreshedAccessToken, refreshedExpiryDate } = await this.getFreshAccessToken(connection);

        const start = event.date;
        const end = event.endDate ?? new Date(start.getTime() + 60 * 60 * 1000);

        const response = await fetch(CALENDAR_EVENTS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                summary: event.title,
                description: event.description,
                location: event.address || event.location,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
            }),
        });

        if (!response.ok) {
            throw new Error(`Google Calendar event creation failed: ${response.status}`);
        }

        const data = (await response.json()) as GoogleCalendarEventResponse;

        return {
            externalEventId: data.id,
            refreshedAccessToken,
            refreshedExpiryDate,
        };
    }

    async deleteEvent(connection: CalendarConnection, externalEventId: string): Promise<void> {
        try {
            const { accessToken } = await this.getFreshAccessToken(connection);
            await fetch(`${CALENDAR_EVENTS_URL}/${externalEventId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
        } catch (err) {
            this.logger.warn(`Could not delete Google Calendar event ${externalEventId}: ${(err as Error).message}`);
        }
    }

    private async getFreshAccessToken(connection: CalendarConnection): Promise<FreshAccessToken> {
        const client = this.createOAuthClient();
        client.setCredentials({
            access_token: connection.accessToken,
            refresh_token: connection.refreshToken,
            expiry_date: connection.tokenExpiresAt ? connection.tokenExpiresAt.getTime() : undefined,
        });

        let refreshedAccessToken: string | null = null;
        let refreshedExpiryDate: Date | null = null;
        client.on('tokens', (tokens) => {
            if (tokens.access_token) refreshedAccessToken = tokens.access_token;
            if (tokens.expiry_date) refreshedExpiryDate = new Date(tokens.expiry_date);
        });

        const { token } = await client.getAccessToken();
        if (!token) {
            throw new Error('Could not obtain a valid Google access token');
        }

        return { accessToken: token, refreshedAccessToken, refreshedExpiryDate };
    }

    private createOAuthClient(): OAuth2Client {
        return new OAuth2Client(
            this.config.get<string>('oauth.google.clientId'),
            this.config.get<string>('oauth.google.clientSecret'),
            this.config.get<string>('oauth.google.calendarCallbackUrl'),
        );
    }
}
