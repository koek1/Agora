'use client';

// ========== Imports: ==========
import { useCurrentUser } from '@/components/UserContext';
import EventForm from '@/components/EventForm';

export default function CreateEventPage() {
    const user = useCurrentUser();

    return (
        <div className="max-w-7xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Skep Geleentheid</h1>
                <p className="text-sm text-[var(--color-text-subtle)] mt-1">
                    Vul alle besonderhede in vir die nuwe geleentheid
                </p>
            </div>

            <EventForm
                mode="create"
                initialValues={{
                    title: '',
                    description: '',
                    date: '',
                    time: '',
                    endTime: '',
                    location: '',
                    type: 'public',
                    intendedAttendance: 'GAS',
                    capacity: '',
                    budget: '',
                    assignedTo: '',
                    assignedToName: '',
                    studyCenter: user.studyCenter,
                    sellsTickets: false,
                    ticketPrice: '',
                    ticketsAvailable: '',
                }}
            />
        </div>
    );
}
