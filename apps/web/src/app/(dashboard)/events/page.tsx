'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import EventCard from '@/components/EventCard';
import InfoModal from '@/components/InfoModal';
import DateRangePicker from '@/components/DateRangePicker';
import { toIsoRange } from '@/lib/date-range';
import ExportCsvButton from '@/components/ExportCsvButton';
import { canCreateEvents } from '@/lib/rbac';
import { useCurrentUser } from '@/components/UserContext';
import { listEventsAction } from '@/lib/actions/event.actions';
import { getMyRsvpsAction } from '@/lib/actions/rsvp.actions';
import type { Event, EventType } from '@/lib/api/events';
import { deriveStatus } from '@/lib/event-view';
import type { EventStatus } from '@/lib/event-view';
import { useSearchParams, useRouter } from 'next/navigation';


const EVENT_TYPE_INFO: { type: string; label: string; color: string; description: string }[] = [
    {
        type: 'public',
        label: 'Publiek',
        color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
        description: 'Oop vir alle gebruikers ongeag hul rol. Geen uitnodiging nodig nie. Sigbaar vir GAS, studente, dosente en admins.',
    },
    {
        type: 'internal_student',
        label: 'Intern - Student',
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        description: 'Slegs vir geregistreerde studente. Dosente en admins kan ook sien. GAS-lede moet spesifiek uitgenooi word.',
    },
    {
        type: 'private',
        label: 'Privaat',
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        description: 'Slegs vir spesifiek uitgenodigde gebruikers. Jy moet \'n direkte uitnodiging van die organiseerder ontvang het om dit te sien.',
    },
    {
        type: 'department',
        label: 'Departement',
        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        description: 'Slegs vir dosente en administrateurs. Nie sigbaar vir studente of GAS-lede nie.',
    },
];

export default function EventsPage() {
    const user = useCurrentUser();

    const [events, setEvents]       = useState<Event[]>([]);
    const [loading, setLoading]     = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [rsvpdEventIds, setRsvpdEventIds] = useState<Set<string>>(new Set());

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');

    // Datumreeks-filter as 'yyyy-mm-dd'-sleutels. dateTo bly leeg solank net een
    // dag gekies is -- dan geld daardie enkele dag as die hele reeks.
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo]     = useState('');

    const rangeActive = Boolean(dateFrom);

    const searchParams = useSearchParams();
    const router = useRouter();
    const [newEventId, setNewEventId] = useState<string | null>(null);
    const [paymentNotice, setPaymentNotice] = useState<'success' | 'cancelled' | null>(null);

    useEffect(() => {
        const created = searchParams.get('created');
        if (created) {
            setNewEventId(created);
            router.replace('/events'); // vee die query-param uit sodat 'n verfris nie die gloed herhaal nie
        }
    }, [searchParams, router]);

    // Land hier ná 'n regte PayFast-herleiding (sien payments.controller.ts se
    // /payments/return en /cancel) -- PayFast se eie ITN bevestig die kaartjie
    // reeds op die agtergrond, hierdie is bloot terugvoer vir die gebruiker.
    useEffect(() => {
        const payment = searchParams.get('payment');
        if (payment === 'success' || payment === 'cancelled') {
            setPaymentNotice(payment);
            router.replace('/events');
        }
    }, [searchParams, router]);

    // Haal die geleenthede van die backend. Rol-sigbaarheid word reeds
    // backend-kant afgedwing, so wys net wat teruggekom het.
    //
    // Bo-grens: einde van volgende maand, verder-in-die-toekoms geleenthede
    // bly die kalenderbladsy se werk. Geen onder-grens nie: verby geleenthede
    // word steeds gehaal sodat die "Verby"-statusfilter hulle kan wys, hulle
    // word net client-kant (matchesStatus hieronder) by verstek weggesteek.
    //
    // 'n Gekose datumreeks vervang daardie verstek-venster heeltemal (dit gaan as
    // from/to na die backend toe), sodat die gebruiker ook verder terug in die
    // verlede of verder in die toekoms as die verstek kan kyk.
    const loadEvents = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);

        try {
            const now = new Date();
            const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

            // Van die oggend van die eerste dag tot die laaste oomblik van die
            // laaste dag. Is net een dag gekies, is daardie dag self albei grense.
            const filters = toIsoRange(dateFrom, dateTo) ?? { to: endOfNextMonth.toISOString() };

            const [eventsResult, rsvpsResult] = await Promise.all([
                listEventsAction(filters),
                getMyRsvpsAction(),
            ]);

            if (eventsResult.error) {
                if (showLoading) setLoadError(eventsResult.error);
            } else {
                setLoadError(null);
                setEvents(eventsResult.events ?? []);
            }

            const activeEventIds = (rsvpsResult.rsvps ?? [])
                .filter((r) => r.status !== 'GEKANSELLEER' && r.event)
                .map((r) => r.event!._id);
            setRsvpdEventIds(new Set(activeEventIds));
            
        } catch {
            if (showLoading) setLoadError('Kon nie geleenthede laai nie.');

        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
     let active = true;

        const initialLoad = async () => {
         if (!active) return;
         await loadEvents(true);
     };

    initialLoad();

    const interval = setInterval(() => {
        if (active) {
            loadEvents(false);
        }
    }, 60000);

    return () => {active = false; 
        clearInterval(interval);
    };
}, [loadEvents]);

    const filtered = events
        .filter((event) => {
            const matchesSearch =
                event.title.toLowerCase().includes(search.toLowerCase()) ||
                event.description.toLowerCase().includes(search.toLowerCase());
            // 'Alle Status' beteken hier alle nie-verby geleenthede, 'n verby
            // geleentheid wys slegs as die 'Verby'-status spesifiek gekies is.
            // Uitsondering: het die gebruiker self 'n datumreeks gekies, dan is die
            // verby geleenthede binne daardie reeks juis wat hy gevra het.
            const matchesStatus =
                statusFilter === 'all'
                    ? rangeActive || deriveStatus(event) !== 'past'
                    : deriveStatus(event) === statusFilter;
            const matchesType = typeFilter === 'all' || event.type === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        })
        // Skuif die pas-geskepte geleentheid na voor sodat die gebruiker dit dadelik
        // sien, sonder om die res van die lys se chronologiese volgorde te verander.
        .sort((a, b) => {
            if (a.id === newEventId) return -1;
            if (b.id === newEventId) return 1;
            return 0;
        });

    const selectClass =
        'bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] rounded-xl px-3 py-2 outline-none cursor-pointer';

    return (
        <div className="space-y-6">

            {paymentNotice && (
                <div
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
                        paymentNotice === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                            : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                    }`}
                >
                    <span>
                        {paymentNotice === 'success'
                            ? 'Jou betaling is ontvang — jou kaartjie word tans bevestig.'
                            : 'Die betaling is gekanselleer.'}
                    </span>
                    <button onClick={() => setPaymentNotice(null)} className="text-xs underline shrink-0">
                        Maak toe
                    </button>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Geleenthede</h1>
                    <p className="text-sm text-[var(--color-text-subtle)] mt-1">
                        {loading ? 'Laai geleenthede…' : `${filtered.length} geleenthede sigbaar vir jou rol`}
                    </p>
                </div>
                <div className="flex item-center gap-2">
                    <ExportCsvButton type="rsvp-summary"/>
                {canCreateEvents(user.role) && (
                    <Link
                        href="/events/create"
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <PlusCircle size={16} />
                        Skep Geleentheid
                    </Link>
                )}
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 flex-1 min-w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2">
                    <Search size={16} className="text-[var(--color-text-subtle)] shrink-0" />
                    <input
                        type="text"
                        placeholder="Soek geleenthede..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none w-full"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as EventStatus | 'all')}
                    className={selectClass}
                >
                    <option value="all">Alle Status</option>
                    <option value="upcoming">Aanstaande</option>
                    <option value="ongoing">Aan die gang</option>
                    <option value="past">Verby</option>
                    <option value="cancelled">Gekanselleer</option>
                </select>

                <div className="flex items-center gap-1.5">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as EventType | 'all')}
                        className={selectClass}
                    >
                        <option value="all">Alle Tipes</option>
                        <option value="public">Publiek</option>
                        <option value="internal_student">Intern - Student</option>
                        <option value="private">Privaat</option>
                        <option value="department">Departement</option>
                    </select>

                    <InfoModal title="Geleentheid Tipes">
                        <p className="text-sm text-[var(--color-text-subtle)] leading-relaxed">
                            Elke geleentheid het 'n tipe wat bepaal wie dit kan sien.
                            Jou rol bepaal watter tipes vir jou sigbaar is.
                        </p>
                        <div className="space-y-2">
                            {EVENT_TYPE_INFO.map((item) => (
                                <div
                                    key={item.type}
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.color}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-subtle)] leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                            <p className="text-xs font-semibold text-[var(--color-text)] mb-1">Jou rol: {user.role}</p>
                            <p className="text-xs text-[var(--color-text-subtle)] leading-relaxed">
                                {user.role === 'ADMIN' && 'Jy kan alle geleenthede sien, ongeag tipe.'}
                                {user.role === 'DOSENT' && 'Jy kan alle aanstaande geleenthede sien, plus geleenthede wat jy geskep het.'}
                                {user.role === 'STUDENT' && 'Jy kan publieke, intern-student geleenthede, en geleenthede waarvoor jy uitgenooi is sien.'}
                                {user.role === 'GAS' && 'Jy kan publieke geleenthede en geleenthede waarvoor jy spesifiek uitgenooi is sien.'}
                            </p>
                        </div>
                    </InfoModal>
                </div>

                {/* Datum-reeks-kieser: leeg = die verstek-venster */}
                <DateRangePicker
                    from={dateFrom}
                    to={dateTo}
                    onChange={(nextFrom, nextTo) => { setDateFrom(nextFrom); setDateTo(nextTo); }}
                />
            </div>

            {/* ── Body ── */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <EventCardSkeleton key={i} />
                    ))}
                </div>
            ) : loadError ? (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                        Kon nie geleenthede laai nie: {loadError.replace(/^\[\d+\]\s*/, '')}
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
                    <p className="text-[var(--color-text-subtle)] text-sm">
                        {rangeActive
                            ? 'Geen geleenthede in die gekose datumreeks nie.'
                            : 'Geen geleenthede gevind nie.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((event) => (
                        <EventCard
                            key={event.id}
                            event={event}
                            alreadyRsvpd={rsvpdEventIds.has(event.id)}
                            isNew={event.id === newEventId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Grys geraamte-kaart terwyl die geleenthede laai
function EventCardSkeleton() {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden animate-pulse">
            <div className="h-1 w-full bg-[var(--color-border)]" />
            <div className="p-5 space-y-3">
                <div className="h-4 w-2/3 rounded bg-[var(--color-border)]" />
                <div className="h-3 w-full rounded bg-[var(--color-border)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
                <div className="h-1.5 w-full rounded bg-[var(--color-border)] mt-4" />
                <div className="h-9 w-full rounded-xl bg-[var(--color-border)] mt-3" />
            </div>
        </div>
    );
}