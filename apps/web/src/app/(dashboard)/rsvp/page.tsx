import { AlertCircle } from 'lucide-react';
import { getMyRsvps } from '@/lib/api/rsvp';
import { getSession } from '@/lib/session';
import MyRsvpList from '@/components/MyRsvpList';
import AutoRefresh from '@/components/AutoRefresh';
import RsvpDateFilter from '@/components/RsvpDateFilter';

export const dynamic = 'force-dynamic';

export default async function MyRsvpsPage({
    searchParams,
}: {
    searchParams: { dateFrom?: string; dateTo?: string };
}) {
    try {
        const rsvps = await getMyRsvps(searchParams.dateFrom, searchParams.dateTo);
        const session = getSession();
        const attendeeName = session ? `${session.name} ${session.surname}` : '';

        return (
            <>
            <AutoRefresh />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">My RSVP&apos;s</h1>
                    <p className="text-sm text-[var(--color-text-subtle)] mt-1">
                        Geleenthede waarvoor jy ingeteken het, en hul QR-kodes
                    </p>
                </div>

                <MyRsvpList initialRsvps={rsvps} dateFilter={<RsvpDateFilter />} attendeeName={attendeeName} />
                
            </div>

            </>
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Onbekende fout het voorgekom';
        return (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-10 text-center space-y-3">
                <AlertCircle size={36} className="mx-auto text-[var(--color-red)]" />
                <p className="text-sm font-semibold text-[var(--color-text)]">Kon nie jou RSVPs laai nie</p>
                <p className="text-xs text-[var(--color-text-subtle)]">{message}</p>
            </div>
        );
    }
}