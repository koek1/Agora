import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { getEventById } from '@/lib/api/events';
import { getUsersByIds } from '@/lib/api/users';
import { getCurrentUser } from '@/lib/get-current-user';
import { getToken } from '@/lib/session';
import EventForm from '@/components/EventForm';

export const dynamic = 'force-dynamic';

// Rond die ISO-datetime af na aparte <input type="date"> / <input type="time"> waardes,
// in plaaslike tyd -- dieselfde manier waarop EventForm hulle weer saamvoeg by indiening.
function toDateTimeInputs(iso: string): { date: string; time: string } {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
    const user = getCurrentUser();

    const event = await getEventById(params.id).catch(() => null);
    if (!event) notFound();

    // Admin mag enige geleentheid wysig; 'n dosent slegs een wat hy self geskep het.
    // Word ook op die backend afgedwing (PATCH /events/:id) -- hierdie is net vir 'n gawe UI.
    const canEdit = user.role === 'ADMIN' || (user.role === 'DOSENT' && event.createdBy === user.id);

    if (!canEdit) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
                <AlertCircle size={48} className="text-[var(--color-red)] mb-4" />
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Toegang Geweier</h2>
                <p className="text-[var(--color-text-subtle)] text-sm">
                    Jy het nie toestemming om hierdie geleentheid te wysig nie.
                </p>
            </div>
        );
    }

    const { date, time } = toDateTimeInputs(event.date);
    const { time: endTime } = event.endDate ? toDateTimeInputs(event.endDate) : { time: '' };

    // Los die vertoonnaam van die toegekende Finansies-gebruiker op vir die soekveld
    const assignee = event.assignedTo
        ? await getUsersByIds([event.assignedTo], getToken())
        : [];

    return (
        <div className="max-w-7xl space-y-6">
            <Link
                href={`/events/${event.id}`}
                className="inline-flex items-center gap-1 text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-colors"
            >
                <ChevronLeft size={16} /> Terug na geleentheid
            </Link>

            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Wysig Geleentheid</h1>
                <p className="text-sm text-[var(--color-text-subtle)] mt-1">{event.title}</p>
            </div>

            <EventForm
                mode="edit"
                eventId={event.id}
                initialValues={{
                    title: event.title,
                    description: event.description,
                    date,
                    time,
                    endTime,
                    location: event.location,
                    type: event.type,
                    intendedAttendance: event.intendedAttendance,
                    capacity: String(event.maxCapacity),
                    budget: String(event.budget),
                    assignedTo: event.assignedTo ?? '',
                    assignedToName: assignee[0] ? `${assignee[0].name} ${assignee[0].surname}` : '',
                    studyCenter: user.studyCenter,
                    sellsTickets: event.sellsTickets,
                    ticketPrice: event.ticketPrice !== null ? String(event.ticketPrice) : '',
                    ticketsAvailable: event.ticketsAvailable !== null ? String(event.ticketsAvailable) : '',
                }}
            />
        </div>
    );
}
