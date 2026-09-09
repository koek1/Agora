import Link from 'next/link';
import type { MyRsvp } from '@/lib/api/rsvp';
import { formatDateShort } from '@/lib/format-date';
import RsvpQrButton from '@/components/RsvpQrButton';
import { Pill } from '@/components/ui/Pill';
import { RSVP_STATUS_LABEL, RSVP_STATUS_TONE } from '@/lib/rsvp-view';

export default function MyBookingsTable({ data, attendeeName }: { data: MyRsvp[]; attendeeName: string }) {
    if (data.length === 0) {
        return (
            <p className="text-xs text-[var(--color-text-subtle)] text-center py-8">
                Jy het nog nie vir enige geleentheid ingeteken nie.
            </p>
        );
    }

    const sorted = [...data].sort((a, b) => {
        const bTime = new Date(b.event?.date ?? b.createdAt).getTime();
        const aTime = new Date(a.event?.date ?? a.createdAt).getTime();
        return bTime - aTime;
    });

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs text-[var(--color-text-subtle)] border-b border-[var(--color-border)]">
                        <th className="pb-2 font-medium">Geleentheid</th>
                        <th className="pb-2 font-medium">Datum</th>
                        <th className="pb-2 font-medium">Ligging</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">QR-kode</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                    {sorted.map((r) => (
                        <tr key={r._id} className="hover:bg-[var(--color-bg)]">
                            <td className="py-2.5 text-[var(--color-text)] font-medium">
                                {r.event ? (
                                    <Link href={`/events/${r.event._id}`} className="hover:text-[var(--color-primary)] hover:underline">
                                        {r.event.title}
                                    </Link>
                                ) : (
                                    'Onbekende geleentheid'
                                )}
                            </td>
                            <td className="py-2.5 text-[var(--color-text-subtle)] whitespace-nowrap">
                                {r.event ? formatDateShort(r.event.date) : '—'}
                            </td>
                            <td className="py-2.5 text-[var(--color-text-subtle)] truncate max-w-[10rem]">
                                {r.event?.location ?? '—'}
                            </td>
                            <td className="py-2.5">
                                <Pill tone={RSVP_STATUS_TONE[r.status]}>
                                    {RSVP_STATUS_LABEL[r.status]}
                                </Pill>
                            </td>
                            <td className="py-2.5 text-right">
                                <RsvpQrButton
                                    rsvpId={r._id}
                                    eventTitle={r.event?.title ?? 'Geleentheid'}
                                    eventDate={r.event ? formatDateShort(r.event.date) : ''}
                                    eventLocation={r.event?.location ?? ''}
                                    eventAddress={r.event?.address ?? ''}
                                    mapsUrl={
                                        r.event?.lat != null && r.event?.lon != null
                                            ? `https://www.google.com/maps/search/?api=1&query=${r.event.lat},${r.event.lon}`
                                            : null
                                    }
                                    attendeeName={attendeeName}
                                    disabled={r.status === 'GEKANSELLEER'}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
