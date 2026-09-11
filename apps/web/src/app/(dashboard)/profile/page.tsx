// ========== Imports: ==========
import { getCurrentUser } from '@/lib/get-current-user';
import { getCalendarStatusAction } from '@/lib/actions/calendar.actions';
import ProfilePanel from '@/components/ProfilePanel';

export default async function ProfilePage() {
    const user = getCurrentUser();
    const calendarStatus = (await getCalendarStatusAction()) ?? {
        google: false,
        microsoft: false,
        googleAccountEmail: null,
        microsoftAccountEmail: null,
    };

    return (
        <div className="space-y-6 max-w-lg">
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">My Profiel</h1>
                <p className="text-sm text-[var(--color-text-subtle)] mt-1">
                    Bestuur jou profielinligting
                </p>
            </div>

            {/* Presies dieselfde paneel as die profiel-kaart wat oor die stelsel oopmaak */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <ProfilePanel user={user} initialCalendarStatus={calendarStatus} />
            </div>
        </div>
    );
}
