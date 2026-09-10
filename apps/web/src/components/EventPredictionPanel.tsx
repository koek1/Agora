'use client';

// ========== Imports: ==========
import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { PredictionResult } from '@/lib/api/analytics';
import { getDraftAttendancePredictionAction } from '@/lib/actions/analytics.actions';

interface EventPredictionPanelProps {
    date: string;
    capacity: string;
    onApplyBudget: (budget: number) => void;
}

export default function EventPredictionPanel({ date, capacity, onApplyBudget }: EventPredictionPanelProps) {
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);
    const [loading, setLoading]       = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [error, setError]           = useState<string | null>(null);

    useEffect(() => {
        const capacityNum = Number(capacity);

        if (!date || !capacityNum || capacityNum <= 0) {
            setPrediction(null);
            setUnavailable(false);
            setError(null);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setLoading(true);
            setUnavailable(false);
            setError(null);

            getDraftAttendancePredictionAction({ date, maxCapacity: capacityNum })
                .then((result) => {
                    if (cancelled) return;
                    if (result.prediction) {
                        setPrediction(result.prediction);
                    } else {
                        setPrediction(null);
                        setUnavailable(!!result.unavailable);
                        setError(result.error ?? null);
                    }
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [date, capacity]);

    if (!date || !Number(capacity)) {
        return (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-[var(--color-primary)]" />
                    <h2 className="text-base font-semibold text-[var(--color-text)]">KI-Voorspelling</h2>
                </div>
                <p className="text-sm text-[var(--color-text-subtle)]">
                    Vul die datum en kapasiteit in op die vorm om 'n voorspelling te sien.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--color-primary)]" />
                <h2 className="text-base font-semibold text-[var(--color-text)]">KI-Voorspelling</h2>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                    <Loader2 size={14} className="animate-spin" />
                    Besig om te voorspel...
                </div>
            )}

            {!loading && unavailable && (
                <p className="text-sm text-[var(--color-text-subtle)]">
                    Voorspellingsdiens is tans nie beskikbaar nie.
                </p>
            )}

            {!loading && error && !unavailable && (
                <p className="text-sm text-[var(--color-red)]">{error}</p>
            )}

            {!loading && prediction && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Stat label="Verwagte Bywoning" value={`${prediction.estimatedAttendees}`} />
                        <Stat label="Vulkoers" value={`${Math.round(prediction.predictedFillRate * 100)}%`} />
                        <Stat label="Nie-opdaag Koers" value={`${Math.round(prediction.predictedNoShowRate * 100)}%`} />
                        <Stat label="Voorgestelde Begroting" value={`R ${prediction.estimatedBudgetZAR.toLocaleString('af-ZA')}`} />
                    </div>

                    <button
                        type="button"
                        onClick={() => onApplyBudget(prediction.estimatedBudgetZAR)}
                        className="w-full py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                        Gebruik Voorgestelde Begroting
                    </button>

                    <div>
                        <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-2">
                            Waarom hierdie voorspelling?
                        </p>
                        <ul className="space-y-1.5">
                            {prediction.reasoning.map((reason, i) => (
                                <li key={i} className="text-xs text-[var(--color-text)] flex gap-2">
                                    <span className="text-[var(--color-primary)]">•</span>
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-3">
            <p className="text-[16px] text-[var(--color-text-subtle)]">{label}</p>
            <p className="text-sm font-bold text-[var(--color-text)] mt-1">{value}</p>
        </div>
    );
}
