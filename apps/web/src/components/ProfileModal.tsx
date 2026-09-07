'use client';

// ========== Imports: ==========
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ProfilePanel, { type Phase } from './ProfilePanel';
import type { MockUser } from '@/lib/mock-data';

interface Props {
    user:    MockUser;
    onClose: () => void;
}

/**
 * Die ingetekende gebruiker se profielkaart. Redigering gebeur binne hierdie
 * selfde raam (sien ProfilePanel). Daar is geen navigasie weg van hier nie.
 */
export default function ProfileModal({ user, onClose }: Props) {
    const [phase, setPhase] = useState<Phase>('view');

    // Escape kanselleer eers die redigering en sluit eers daarna die kaart, sodat
    // 'n halwe redigering nooit stilweg saam met die venster verdwyn nie.
    const phaseRef = useRef<Phase>('view');
    phaseRef.current = phase;

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && phaseRef.current === 'view') onClose();
        }
        document.addEventListener('keydown', handleKeyDown);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    // Klik buite die kaart sluit dit, maar nooit terwyl daar geredigeer word nie.
    function handleBackdropClick() {
        if (phase === 'view') onClose();
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="My profiel"
        >
            <div
                className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {phase === 'view' && (
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:bg-[var(--color-border)] transition-colors"
                        aria-label="Maak toe"
                    >
                        <X size={15} />
                    </button>
                )}

                <ProfilePanel user={user} onPhaseChange={setPhase} />
            </div>
        </div>
    );
}
