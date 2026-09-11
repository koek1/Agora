import { getSession } from './session';
import { MOCK_CURRENT_USER, type MockUser } from './mock-data';

/**
 * Server-only helper. Reads the JWT cookie and returns a MockUser.
 * Falls back to MOCK_CURRENT_USER if there is no valid session
 * (middleware should prevent unauthenticated access before this runs).
 */
export function getCurrentUser(): MockUser {
    const session = getSession();
    if (!session) return MOCK_CURRENT_USER;

    return {
        id: session.id ?? 'unknown',
        name: session.name ?? 'Gebruiker',
        surname: session.surname ?? '',
        email: session.email ?? '',
        role: (session.role as MockUser['role']) ?? 'GAS',
        studyCenter: session.studyCenter ?? 'Onbekend',
        isActive: session.isActive ?? true,
        title: session.title ?? '',
        tags: (session.tags as MockUser['tags']) ?? [],
    };
}
