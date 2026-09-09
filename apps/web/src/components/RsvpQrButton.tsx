'use client';

import { useRef, useState } from 'react';
import { QrCode, X, Loader2, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getRsvpQrAction } from '@/lib/actions/rsvp.actions';

interface RsvpQrButtonProps {
    rsvpId: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
    eventAddress: string;
    mapsUrl: string | null;
    attendeeName: string;
    disabled?: boolean;
}

export default function RsvpQrButton({ rsvpId, eventTitle, eventDate, eventLocation, eventAddress, mapsUrl, attendeeName, disabled }: RsvpQrButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [qrDataUri, setQrDataUri] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    const ticketRef = useRef<HTMLDivElement>(null);

    async function handleOpen() {
        setOpen(true);
        if (qrDataUri) return;
        setLoading(true);
        setError(null);
        const result = await getRsvpQrAction(rsvpId);
        if (result.error) setError(result.error);
        else setQrDataUri(result.qrDataUri ?? null);
        setLoading(false);
    }

    function close() {
        setOpen(false);
    }

    async function handleDownload() {
        if (!ticketRef.current) return;
        setDownloading(true);
        try {
            const dataUrl = await toPng(ticketRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `kaartjie-${eventTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.click();
        } finally {
            setDownloading(false);
        }
    }

    if (disabled) {
        return <span className="text-xs text-[var(--color-text-subtle)]">—</span>;
    }

    return (
        <>
            <button
                onClick={handleOpen}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
                <QrCode size={14} />
                QR-kode
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={close}
                >
                    <div
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-[var(--color-text)] truncate pr-2">{eventTitle}</h3>
                            <button
                                onClick={close}
                                className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:bg-[var(--color-border)] transition-colors shrink-0"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center py-10 gap-3">
                                <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
                                <p className="text-xs text-[var(--color-text-subtle)]">Laai QR-kode...</p>
                            </div>
                        ) : error ? (
                            <p className="text-sm text-[var(--color-red)] text-center py-6">{error}</p>
                        ) : qrDataUri ? (
                            <div className="flex flex-col items-center gap-4">
                                <div
                                    ref={ticketRef}
                                    className="w-full flex flex-col items-center gap-3 bg-white text-black rounded-xl border-2 border-dashed border-gray-300 p-4"
                                >
                                    <div className="text-center">
                                        <p className="text-sm font-bold">{eventTitle}</p>
                                        <p className="text-xs text-gray-600">{eventDate}</p>
                                        <p className="text-xs text-gray-600">{eventLocation}</p>
                                        {eventAddress && (
                                            <p className="text-xs text-gray-600">{eventAddress}</p>
                                        )}
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={qrDataUri}
                                        alt={`QR-kode vir ${eventTitle}`}
                                        className="w-56 h-56 rounded-lg border border-gray-200"
                                    />
                                    {attendeeName && (
                                        <p className="text-xs font-semibold">{attendeeName}</p>
                                    )}
                                </div>
                                <p className="text-xs text-[var(--color-text-subtle)] text-center">
                                    Wys hierdie QR-kode by die deur
                                </p>
                                {mapsUrl && (
                                    <a
                                        href={mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                                    >
                                        Kry aanwysings
                                    </a>
                                )}
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                                >
                                    <Download size={15} />
                                    {downloading ? 'Skep kaartjie...' : 'Laai af'}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </>
    );
}
