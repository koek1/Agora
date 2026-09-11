// ========== Imports: ==========
import { apiClient } from './client';
import type { UserResponse, UserTag } from './client';

// Mirror backend: UserTitle enumeration:
export enum UserTitle {
    DR = 'Dr.',
    PROF = 'Prof.',
    LEC = 'Lec.',
    MNR = 'Mnr.',
    MEV = 'Mev.',
    MX = 'Mx.',
    NONE = '',
}

// Mirror backend: tags an admin can grant a user, independent of their role.
export const ALL_USER_TAGS: Array<{ value: UserTag; label: string }> = [
    { value: 'FINANCE', label: 'Finansies' },
];

export function getTagLabel(tag: UserTag): string {
    return ALL_USER_TAGS.find((t) => t.value === tag)?.label ?? tag;
}

export interface UpdateUserDto {
    name?: string;
    surname?: string;
    title?: UserTitle;
    tags?: UserTag[];
}

// Update users's profile, Self or admin - enforced by the backend:
export async function updateUser(id: string, payload: UpdateUserDto): Promise<UserResponse> {
    return apiClient.patch<UserResponse>(`/users/${id}`, payload);
}

// ADMIN-only: lys elke geregistreerde gebruiker in die stelsel.
export async function getAllUsers(): Promise<UserResponse[]> {
    return apiClient.get<UserResponse[]>('/users/all');
}

// Delete your own account permanently
export async function deleteAccount(): Promise <void> {
    return apiClient.delete<void>('/users/me');
}