'use client';

// ========== Imports: ==========
import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { PredictionResult } from '@/lib/api/analytics';
import DatePicker from '@/components/DatePicker';
import { previewEventAction } from '@/lib/actions/event-planner.actions';

interface EventPlannerSandboxProps {
    initialDate:     string;
    initialCapacity: string;
    onApplyToForm:   (date: string, capacity: number, budget: number) => void;
}

export default function EventPlannerSandbox({ initialDate, initialCapacity, onApplyToForm }: EventPlannerSandboxProps) {
    const [sandboxDate, setSandboxDate]         = useState(initialDate);
    const [sandboxCapacity, setSandboxCapacity] = useState(initialCapacity);
    const [prediction, setPrediction]           = useState<PredictionResult | null>(null);
    const [loading, setLoading]                 = useState(false);
    const [unavailable, setUnavailable]         = useState(false);
    const [error, setError]                     = useState<string | null>(null);

    useEffect(() => {
        const capacityNum = Number(sandboxCapacity);

        if (!sandboxDate || !capacityNum || capacityNum <= 0) {
            setPrediction(null);
            setUnavailable(false);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setLoading(true);
            setUnavailable(false);
            setError(null);

            previewEventAction({ date: sandboxDate, maxCapacity: capacityNum })
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
    }, [sandboxDate, sandboxCapacity]);

    function handleReset() {
        setSandboxDate('');
        setSandboxCapacity('');
    }

    function handleApply() {
        if (!prediction) return;
        onApplyToForm(sandboxDate, Number(sandboxCapacity), prediction.estimatedBudgetZAR);
    }

    const inputClass =
        'w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)]';

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-[var(--color-primary)]" />
                    <h2 className="text-base font-semibold text-[var(--color-text)]">KI-Speeltuin</h2>
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    title="Maak skoon"
                    className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                >
                    <RotateCcw size={14} />
                </button>
            </div>

            <p className="text-xs text-[var(--color-text-subtle)]">
                Verstel die datum en kapasiteit hieronder om verskillende uitkomste te verken. Niks word gestoor nie.
            </p>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Datum
                    </label>
                    <DatePicker
                        value={sandboxDate}
                        onChange={setSandboxDate}
                        placeholder="Kies datum"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Kapasiteit
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={sandboxCapacity}
                        onChange={(e) => setSandboxCapacity(e.target.value)}
                        className={inputClass}
                    />
                </div>
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
                        onClick={handleApply}
                        className="w-full px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        Pas hierdie instellings toe op die vorm
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
            <p className="text-xs text-[var(--color-text-subtle)]">{label}</p>
            <p className="text-sm font-bold text-[var(--color-text)] mt-1">{value}</p>
        </div>
    );
}
