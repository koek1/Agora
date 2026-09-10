import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, Users, ChevronLeft, Pencil, Wallet, CreditCard } from 'lucide-react';
import { getEventById } from '@/lib/api/events';
import { getPhotographersByIds } from '@/lib/api/photographer';
import { getUsersByIds } from '@/lib/api/users';
import { getMyRsvps } from '@/lib/api/rsvp';
import { getCurrentUser } from '@/lib/get-current-user';
import { getToken } from '@/lib/session';
import { formatDateLong as formatDate } from '@/lib/format-date';
import PhotographerSection from '@/components/PhotographerSection';
import { Pill } from '@/components/ui/Pill';
import PaymentModal from '@/components/PaymentModal';
import AlreadyRsvpdTag from '@/components/AlreadyRsvpdTag';

export const dynamic = 'force-dynamic';

function fmtRand(v: number): string {
    return `R${Math.round(v).toLocaleString('af-ZA')}`;
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
    const user = getCurrentUser();

    const event = await getEventById(params.id).catch(() => null);
    if (!event) notFound();

    const myRsvps = await getMyRsvps().catch(() => []);
    const alreadyRsvpd = myRsvps.some((r) => r.status !== 'GEKANSELLEER' && r.event?._id === event.id);

    // admin bestuur/wysig alle geleenthede, dosent net wat hy self geskep het
    const canManageEvent = user.role === 'ADMIN' || (user.role === 'DOSENT' && event.createdBy === user.id);
    // die begroting is sigbaar vir bestuurders van die geleentheid, en vir die
    // gebruiker met die Finansies-tag wat spesifiek hieraan toegeken is
    const canViewFinance = canManageEvent || event.assignedTo === user.id;

    // los die reeds-toegewysde fotograwe op hul ID's op
    const assigned =
        canManageEvent && event.photographers.length
            ? await getPhotographersByIds(event.photographers)
            : [];

    // los die toegekende Finansies-gebruiker se naam op (net nodig vir wie dit bestuur)
    const assignee =
        canManageEvent && event.assignedTo
            ? await getUsersByIds([event.assignedTo], getToken())
            : [];

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between gap-4">
                <Link
                    href="/events"
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-colors"
                >
                    <ChevronLeft size={16} /> Terug na geleenthede
                </Link>
                {canManageEvent && (
                    <Link
                        href={`/events/${event.id}/edit`}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
                    >
                        <Pencil size={14} /> Wysig
                    </Link>
                )}
            </div>

            {/* Geleentheid-besonderhede */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">{event.title}</h1>
                    {event.sellsTickets && <Pill tone="yellow">Betaalde Geleentheid</Pill>}
                </div>
                <p className="text-sm text-[var(--color-text-subtle)] leading-relaxed">{event.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                        <Calendar size={15} className="shrink-0" /> <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 text-sm text-[var(--color-text-subtle)] min-w-0">
                        <div className="flex items-center gap-2">
                            <MapPin size={15} className="shrink-0" /> <span className="truncate">{event.address || event.location}</span>
                        </div>
                        {event.address && event.location && (
                            <span className="text-xs truncate pl-[23px]">{event.location}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                        <Users size={15} className="shrink-0" /> <span>{event.confirmedAttendees} / {event.maxCapacity}</span>
                    </div>
                </div>
            </div>

            {/* Kaartjies — sigbaar vir almal wat die geleentheid kan sien */}
            {event.sellsTickets && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-3">
                    <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-[var(--color-primary)]" />
                        <span className="text-sm font-semibold text-[var(--color-text)]">Kaartjies</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-subtle)]">Prys</span>
                        <span className="font-medium text-[var(--color-text)]">R{event.ticketPrice}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-subtle)]">Beskikbaar</span>
                        <span className="font-medium text-[var(--color-text)]">{event.ticketsAvailable}</span>
                    </div>
                    <div className="pt-1">
                        {alreadyRsvpd ? <AlreadyRsvpdTag eventId={event.id} /> : <PaymentModal event={event} />}
                    </div>
                </div>
            )}

            {/* Finansiële afdeling — bestuurders van die geleentheid, en die toegekende Finansies-gebruiker */}
            {canViewFinance && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-3">
                    <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-[var(--color-primary)]" />
                        <span className="text-sm font-semibold text-[var(--color-text)]">Finansies</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-subtle)]">Begroting</span>
                        <span className="font-medium text-[var(--color-text)]">{fmtRand(event.budget)}</span>
                    </div>
                    {assignee[0] && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-subtle)]">Toegeken aan</span>
                            <span className="font-medium text-[var(--color-text)]">{assignee[0].name} {assignee[0].surname}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Fotograaf-afdeling — net vir admin, of die dosent wat die geleentheid geskep het */}
            {canManageEvent && (
                <PhotographerSection
                    eventId={event.id}
                    initialAssigned={assigned}
                    initialInstructions={event.photographerInstructions}
                />
            )}
        </div>
    );
}