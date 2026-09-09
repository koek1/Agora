// ========== Imports: ==========
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventDocument } from '../../events/schemas/event.schema';
import { CalendarConnection } from '../../users/schemas/calendar-connection.schema';

interface MicrosoftTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

interface MicrosoftGraphProfile {
    mail?: string;
    userPrincipalName?: string;
}

export interface MicrosoftTokenResult {
    accessToken: string;
    refreshToken: string | null;
    expiryDate: Date;
    accountEmail: string;
}

const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me';
const GRAPH_EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events';
const CALENDAR_SCOPES = 'offline_access Calendars.ReadWrite User.Read';

@Injectable()
export class MicrosoftCalendarService {
    private readonly logger = new Logger(MicrosoftCalendarService.name);

    constructor(private readonly config: ConfigService) {}

    buildAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.get<string>('oauth.microsoft.clientId')!,
            response_type: 'code',
            redirect_uri: this.config.get<string>('oauth.microsoft.calendarCallbackUrl')!,
            response_mode: 'query',
            scope: CALENDAR_SCOPES,
            prompt: 'select_account',
            state,
        });
        return `${AUTHORIZE_URL}?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<MicrosoftTokenResult> {
        const tokens = await this.requestToken({
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.config.get<string>('oauth.microsoft.calendarCallbackUrl')!,
        });

        const profile = await this.fetchProfile(tokens.access_token);

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
            accountEmail: profile.mail ?? profile.userPrincipalName ?? '',
        };
    }

    async ensureFreshToken(connection: CalendarConnection): Promise<CalendarConnection | null> {
        if (!connection.refreshToken) return null;
        if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() > 60_000) {
            return null;
        }

        const tokens = await this.requestToken({
            refresh_token: connection.refreshToken,
            grant_type: 'refresh_token',
        });

        return {
            ...connection,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? connection.refreshToken,
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        };
    }

    async createEvent(connection: CalendarConnection, event: EventDocument): Promise<string> {
        const start = event.date;
        const end = event.endDate ?? new Date(start.getTime() + 60 * 60 * 1000);

        const response = await fetch(GRAPH_EVENTS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${connection.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subject: event.title,
                body: { contentType: 'Text', content: event.description },
                location: { displayName: event.address || event.location },
                start: { dateTime: start.toISOString(), timeZone: 'UTC' },
                end: { dateTime: end.toISOString(), timeZone: 'UTC' },
            }),
        });

        if (!response.ok) {
            throw new Error(`Microsoft Graph event creation failed: ${response.status}`);
        }

        const data = (await response.json()) as { id: string };
        return data.id;
    }

    async deleteEvent(connection: CalendarConnection, externalEventId: string): Promise<void> {
        try {
            await fetch(`${GRAPH_EVENTS_URL}/${externalEventId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${connection.accessToken}` },
            });
        } catch (err) {
            this.logger.warn(`Could not delete Outlook Calendar event ${externalEventId}: ${(err as Error).message}`);
        }
    }

    private async requestToken(params: Record<string, string>): Promise<MicrosoftTokenResponse> {
        const body = new URLSearchParams({
            client_id: this.config.get<string>('oauth.microsoft.clientId')!,
            client_secret: this.config.get<string>('oauth.microsoft.clientSecret')!,
            scope: CALENDAR_SCOPES,
            ...params,
        });

        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!response.ok) {
            throw new Error(`Microsoft token exchange failed: ${response.status}`);
        }

        return (await response.json()) as MicrosoftTokenResponse;
    }

    private async fetchProfile(accessToken: string): Promise<MicrosoftGraphProfile> {
        const response = await fetch(GRAPH_ME_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            throw new Error(`Microsoft profile fetch failed: ${response.status}`);
        }

        return (await response.json()) as MicrosoftGraphProfile;
    }
}
