'use client';

// ========== Imports: ==========
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { useCurrentUser } from '@/components/UserContext';
import { canCreateEvents } from '@/lib/rbac';
import { createEventAction, updateEventAction } from '@/lib/actions/event.actions';
import { ATTENDANCE_OPTIONS, type AttendanceRole } from '@/lib/attendance';
import type { EventType } from '@/lib/api/events';
import DatePicker from '@/components/DatePicker';
import EventPredictionPanel from '@/components/EventPredictionPanel';
import EventPlannerSandbox from '@/components/EventPlannerSandbox';
import FinanceAssigneeSelect from '@/components/FinanceAssigneeSelect';
import TimeRangeInput from '@/components/TimeRangeInput';

const STUDY_CENTERS = [
    'Centurion - Leriba',
    'Centurion - Gerhard straat',
    'Paarl',
    'George',
    'Somerset Wes',
];

export interface EventFormValues {
    title:              string;
    description:        string;
    date:               string;
    time:               string;
    endTime:            string;
    location:           string;
    type:               EventType;
    intendedAttendance: AttendanceRole;
    capacity:           string;
    budget:             string;
    assignedTo:         string;
    assignedToName:     string;
    studyCenter:        string;
    sellsTickets:       boolean;
    ticketPrice:        string;
    ticketsAvailable:   string;
}

interface EventFormProps {
    mode:          'create' | 'edit';
    eventId?:      string;
    initialValues: EventFormValues;
}

export default function EventForm({ mode, eventId, initialValues }: EventFormProps) {
    const router = useRouter();
    const user = useCurrentUser();

    const [formData, setFormData] = useState({...initialValues, time: initialValues.time || '08:00', endTime: initialValues.endTime || '09:00'});

    const [apiError, setApiError]       = useState<string | null>(null);
    const [isPending, startTransition]  = useTransition();
    const [errors, setErrors]           = useState<Record<string, string>>({});

    if (mode === 'create' && !canCreateEvents(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
                <AlertCircle size={48} className="text-[var(--color-red)] mb-4" />
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Toegang Geweier</h2>
                <p className="text-[var(--color-text-subtle)] text-sm">
                    Jy het nie toestemming om geleenthede te skep nie.
                </p>
            </div>
        );
    }

    function validate() {
        const e: Record<string, string> = {};
        if (!formData.title.trim()) e.title = 'Titel is verpligtend';
        if (!formData.description.trim()) e.description = 'Beskrywing is verpligtend';
        if (!formData.date) e.date = 'Datum is verpligtend';
                if (!formData.time) e.time = 'Begintyd is verpligtend';
        if (!formData.endTime) e.endTime = 'Eindtyd is verpligtend';
        if (formData.time && formData.endTime && formData.endTime <= formData.time) 
        {
            e.endTime = 'Eindtyd moet na begintyd wees';
        }
        if (!formData.location.trim()) e.location = 'Ligging is verpligtend';
        if (!formData.capacity || Number(formData.capacity) <= 0)
            e.capacity = 'Geldige kapasiteit is verpligtend';
        if (formData.budget === '' || Number(formData.budget) < 0)
            e.budget = 'Geldige begroting is verpligtend';
        if (formData.sellsTickets) {
            if (!formData.ticketPrice || Number(formData.ticketPrice) <= 0)
                e.ticketPrice = 'Geldige kaartjieprys is verpligtend';
            if (!formData.ticketsAvailable || Number(formData.ticketsAvailable) <= 0)
                e.ticketsAvailable = 'Geldige aantal kaartjies is verpligtend';
        }
        return e;
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setApiError(null);
        startTransition(async () => {
            const payload = {
                title:              formData.title,
                description:        formData.description,
                date:               `${formData.date}T${formData.time}`,
                endDate:            `${formData.date}T${formData.endTime}`,
                location:           formData.location,
                maxCapacity:        Number(formData.capacity),
                budget:             Number(formData.budget),
                intendedAttendance: formData.intendedAttendance,
                assignedTo:         formData.assignedTo || undefined,
                type:               formData.type,
                sellsTickets:       formData.sellsTickets,
                ticketPrice:        formData.sellsTickets ? Number(formData.ticketPrice) : undefined,
                ticketsAvailable:   formData.sellsTickets ? Number(formData.ticketsAvailable) : undefined,
            };

            if (mode === 'create') {
                const result = await createEventAction(payload);
                if (result.error) {
                    setApiError(result.error);
                } else {
                    router.push(`/events?created=${result.id}`);
                }
            } else {
                const err = await updateEventAction(eventId!, payload);
                if (err) {
                    setApiError(err);
                } else {
                    router.push(`/events/${eventId}`);
                }
            }
        });
    }

    function handleChange(field: string, value: string) {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    function handleApplyBudget(budget: number) {
        setFormData((prev) => ({ ...prev, budget: String(budget) }));
        if (errors.budget) setErrors((prev) => ({ ...prev, budget: '' }));
    }

    function handleApplySandbox(date: string, capacity: number, budget: number) {
        setFormData((prev) => ({ ...prev, date, capacity: String(capacity), budget: String(budget) }));
        setErrors((prev) => ({ ...prev, date: '', capacity: '', budget: '' }));
    }

    const inputClass = (field: string) =>
        [
            'w-full bg-[var(--color-bg)] border rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)]',
            'placeholder:text-[var(--color-text-subtle)] outline-none transition-colors',
            errors[field]
                ? 'border-[var(--color-red)]'
                : 'border-[var(--color-border)] focus:border-[var(--color-primary)]',
        ].join(' ');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            <form
                onSubmit={handleSubmit}
                className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-5"
            >
                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Titel
                    </label>
                    <input
                        type="text"
                        placeholder="Geleentheid naam..."
                        value={formData.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className={inputClass('title')}
                    />
                    {errors.title && (
                        <p className="text-xs text-[var(--color-red)] mt-1">{errors.title}</p>
                    )}
                </div>

                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Beskrywing
                    </label>
                    <textarea
                        placeholder="Beskryf die geleentheid..."
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
                        className={`${inputClass('description')} resize-none`}
                    />
                    {errors.description && (
                        <p className="text-xs text-[var(--color-red)] mt-1">{errors.description}</p>
                    )}
                </div>
                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Datum
                    </label>
                    <DatePicker
                        value={formData.date}
                        onChange={(date) => handleChange('date', date)}
                        placeholder="Kies datum"
                    />
                    {errors.date && (
                        <p className="text-xs text-[var(--color-red)] mt-1">{errors.date}</p>
                    )}
                </div>

                <TimeRangeInput
                    startTime={formData.time}
                    endTime={formData.endTime}
                    onStartTimeChange={(v) => handleChange('time', v)}
                    onEndTimeChange={(v) => handleChange('endTime', v)}
                    startError={errors.time}
                    endError={errors.endTime}
                />

                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Ligging
                    </label>
                    <input
                        type="text"
                        placeholder="Saal, gebou of adres..."
                        value={formData.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                        className={inputClass('location')}
                    />
                    {errors.location && (
                        <p className="text-xs text-[var(--color-red)] mt-1">{errors.location}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                            Tipe
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => handleChange('type', e.target.value)}
                            className={inputClass('type')}
                        >
                            <option value="public">Publiek</option>
                            <option value="internal_student">Intern - Student</option>
                            <option value="private">Privaat</option>
                            <option value="department">Departement</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                            Studiesentrum
                        </label>
                        <select
                            value={formData.studyCenter}
                            onChange={(e) => handleChange('studyCenter', e.target.value)}
                            className={inputClass('studyCenter')}
                        >
                            {STUDY_CENTERS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Sigbaarheid (wie kan dit sien)
                    </label>
                    <select
                        value={formData.intendedAttendance}
                        onChange={(e) => handleChange('intendedAttendance', e.target.value)}
                        className={inputClass('intendedAttendance')}
                    >
                        {ATTENDANCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                            Kapasiteit
                        </label>
                        <input
                            type="number"
                            placeholder="Maks. deelnemers"
                            value={formData.capacity}
                            onChange={(e) => handleChange('capacity', e.target.value)}
                            min="1"
                            className={inputClass('capacity')}
                        />
                        {errors.capacity && (
                            <p className="text-xs text-[var(--color-red)] mt-1">{errors.capacity}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                            Begroting (R)
                        </label>
                        <input
                            type="number"
                            placeholder="Totale begroting"
                            value={formData.budget}
                            onChange={(e) => handleChange('budget', e.target.value)}
                            min="0"
                            className={inputClass('budget')}
                        />
                        {errors.budget && (
                            <p className="text-xs text-[var(--color-red)] mt-1">{errors.budget}</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                        Toegeken aan (Finansies)
                    </label>
                    <FinanceAssigneeSelect
                        value={formData.assignedTo}
                        valueName={formData.assignedToName}
                        onChange={(id, name) =>
                            setFormData((prev) => ({ ...prev, assignedTo: id, assignedToName: name }))
                        }
                    />
                </div>

                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                        <input
                            type="checkbox"
                            checked={formData.sellsTickets}
                            onChange={(e) => setFormData((prev) => ({ ...prev, sellsTickets: e.target.checked }))}
                            className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                        />
                        Hierdie geleentheid verkoop kaartjies
                    </label>

                    {formData.sellsTickets && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                                    Kaartjieprys (R)
                                </label>
                                <input
                                    type="number"
                                    placeholder="Prys per kaartjie"
                                    value={formData.ticketPrice}
                                    onChange={(e) => handleChange('ticketPrice', e.target.value)}
                                    min="0.01"
                                    step="0.01"
                                    className={inputClass('ticketPrice')}
                                />
                                {errors.ticketPrice && (
                                    <p className="text-xs text-[var(--color-red)] mt-1">{errors.ticketPrice}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[var(--color-text-subtle)] block mb-1.5">
                                    Kaartjies Beskikbaar
                                </label>
                                <input
                                    type="number"
                                    placeholder="Aantal te koop"
                                    value={formData.ticketsAvailable}
                                    onChange={(e) => handleChange('ticketsAvailable', e.target.value)}
                                    min="1"
                                    className={inputClass('ticketsAvailable')}
                                />
                                {errors.ticketsAvailable && (
                                    <p className="text-xs text-[var(--color-red)] mt-1">{errors.ticketsAvailable}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {apiError && (
                    <div
                        className="px-4 py-3 rounded-[12px] border text-[16px] font-semibold"
                        style={{
                            background:  'var(--color-bg)',
                            borderColor: 'var(--color-red)',
                            color:       'var(--color-red)',
                        }}
                    >
                        {apiError}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {mode === 'create' ? 'Besig om te skep...' : 'Besig om te stoor...'}
                        </>
                    ) : mode === 'create' ? (
                        'Skep Geleentheid'
                    ) : (
                        'Stoor Veranderinge'
                    )}
                </button>
            </form>

            <div className="lg:col-span-1 xl:col-span-2 space-y-6 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start">
                <EventPredictionPanel
                    date={formData.date}
                    capacity={formData.capacity}
                    onApplyBudget={handleApplyBudget}
                />
                <EventPlannerSandbox
                    initialDate={formData.date}
                    initialCapacity={formData.capacity}
                    onApplyToForm={handleApplySandbox}
                />
            </div>
        </div>
    );
}
