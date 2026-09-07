'use client';

// ========== Imports: ==========
import { useEffect, useState } from 'react';
import { Pencil, Check, Loader2, Mail, ShieldCheck, Building2, Activity, Tag, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Pill } from '@/components/ui/Pill';
import { getRoleLabel, getRoleTone, getTagLabel, getTagTone } from '@/lib/rbac';
import { updateProfileAction } from '@/lib/actions/user.actions';
import { getCalendarStatusAction } from '@/lib/actions/calendar.actions';
import { UserTitle } from '@/lib/api/users';
import type { CalendarStatus } from '@/lib/api/calendar';
import type { MockUser } from '@/lib/mock-data';
import CalendarConnections from '@/app/(dashboard)/profile/calendar-connections';
import DeleteAccountSection from '@/app/(dashboard)/profile/delete-account-section';

const TITLE_OPTIONS: { value: UserTitle; label: string }[] = [
    { value: UserTitle.NONE, label: '(Geen titel)' },
    { value: UserTitle.DR,   label: 'Dr.' },
    { value: UserTitle.PROF, label: 'Prof.' },
    { value: UserTitle.LEC,  label: 'Lec.' },
    { value: UserTitle.MNR,  label: 'Mnr.' },
    { value: UserTitle.MEV,  label: 'Mev.' },
    { value: UserTitle.MX,   label: 'Mx.' },
];

const FIELD_CLASS =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

interface Props {
    user: MockUser;
    /** Die bladsy haal die status op die bediener, die modaal laat dit weg en haal dit self. */
    initialCalendarStatus?: CalendarStatus | null;
    /** Laat die modaal weet wanneer die redigeer-fase begin of eindig. */
    onPhaseChange?: (phase: Phase) => void;
}

export type Phase = 'view' | 'edit';

/**
 * Die volledige profiel, in twee fases binne dieselfde raam.
 *
 * 'view'  -- alles lees-alleen, plus kalender-koppelinge en die gevaarsone.
 * 'edit'  -- net die velde wat die gebruiker self mag verander word invoervelde;
 *            kalender en gevaarsone verdwyn tydelik sodat die fase een ding doen.
 *
 * Kanselleer stel die konsepwaardes terug na wat gestoor is, sodat 'n halwe
 * redigering nooit oorleef nie.
 */
export default function ProfilePanel({ user, initialCalendarStatus, onPhaseChange }: Props) {
    const [phase, setPhaseState] = useState<Phase>('view');

    const savedTitle = (user.title as UserTitle) ?? UserTitle.NONE;
    const [name, setName]       = useState(user.name);
    const [surname, setSurname] = useState(user.surname);
    const [title, setTitle]     = useState<UserTitle>(savedTitle);

    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(
        initialCalendarStatus ?? null,
    );

    // Die modaal gee geen status deur nie, so haal dit self sodra dit oopmaak.
    useEffect(() => {
        if (initialCalendarStatus !== undefined) return;
        let active = true;
        getCalendarStatusAction()
            .then((status) => { if (active) setCalendarStatus(status); })
            .catch(() => { /* Laat die kalender-blok eenvoudig weg as dit nie laai nie */ });
        return () => { active = false; };
    }, [initialCalendarStatus]);

    function setPhase(next: Phase) {
        setPhaseState(next);
        onPhaseChange?.(next);
    }

    function startEdit() {
        setJustSaved(false);
        setPhase('edit');
    }

    // Kanselleer gooi elke onvoltooide verandering weg.
    function discardEdit() {
        setName(user.name);
        setSurname(user.surname);
        setTitle(savedTitle);
        setError(null);
        setConfirmDiscard(false);
        setPhase('view');
    }

    // Niks getik nie, dan is daar niks om te bevestig nie, en gaan ons reguit terug.
    function requestCancel() {
        if (dirty) {
            setConfirmDiscard(true);
            return;
        }
        discardEdit();
    }

    function edit<T>(setter: (value: T) => void) {
        return (value: T) => {
            setter(value);
            setError(null);
        };
    }

    const dirty =
        name.trim() !== user.name ||
        surname.trim() !== user.surname ||
        title !== savedTitle;
    const incomplete = !name.trim() || !surname.trim();

    async function handleSave() {
        setSaving(true);
        setError(null);

        const result = await updateProfileAction({ name, surname, title });

        setSaving(false);
        if (result.error) {
            setError(result.error);
            return;
        }

        // Terug na die kyk-fase, met die kalender en gevaarsone weer sigbaar.
        setJustSaved(true);
        setPhase('view');
    }

    const initials = `${user.name.charAt(0)}${user.surname.charAt(0)}`;
    const displayName =
        phase === 'edit'
            ? [title, name, surname].filter((part) => part.trim()).join(' ')
            : [user.title, user.name, user.surname].filter(Boolean).join(' ');
    const tags = user.tags ?? [];

    return (
        <div>
            {confirmDiscard && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setConfirmDiscard(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Bevestig kansellasie"
                >
                    <div
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-7 h-7 rounded-full bg-[var(--color-red)] flex items-center justify-center shrink-0">
                                <TriangleAlert size={13} className="text-white" />
                            </span>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">
                                Gooi veranderinge weg?
                            </h3>
                        </div>

                        <p className="text-sm text-[var(--color-text)] leading-relaxed">
                            Jy het veranderinge gemaak wat nog nie gestoor is nie. As jy kanselleer,
                            gaan hulle verlore.
                        </p>

                        <div className="flex gap-2 pt-4">
                            <button
                                onClick={() => setConfirmDiscard(false)}
                                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
                            >
                                Hou aan redigeer
                            </button>
                            <button
                                onClick={discardEdit}
                                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-red)] text-white hover:opacity-90 transition-opacity"
                            >
                                Gooi weg
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kop -- avatar, naam en rol. Bly in albei fases staan. */}
            <div className="px-5 pt-6 pb-5 border-b border-[var(--color-border)] text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-text)] text-xl font-bold">
                    {initials}
                </div>

                <h3 className="mt-3 text-base font-bold text-[var(--color-text)] break-words">
                    {displayName || '—'}
                </h3>

                <div className="mt-2 flex justify-center">
                    <Pill tone={getRoleTone(user.role)}>{getRoleLabel(user.role)}</Pill>
                </div>
            </div>

            <div className="px-5 py-4 space-y-4">
                {phase === 'edit' ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="profile-name" className="block text-xs font-medium text-[var(--color-text-subtle)]">
                                    Naam
                                </label>
                                <input
                                    id="profile-name"
                                    type="text"
                                    value={name}
                                    maxLength={50}
                                    autoComplete="given-name"
                                    onChange={(e) => edit(setName)(e.target.value)}
                                    className={FIELD_CLASS}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="profile-surname" className="block text-xs font-medium text-[var(--color-text-subtle)]">
                                    Van
                                </label>
                                <input
                                    id="profile-surname"
                                    type="text"
                                    value={surname}
                                    maxLength={50}
                                    autoComplete="family-name"
                                    onChange={(e) => edit(setSurname)(e.target.value)}
                                    className={FIELD_CLASS}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="profile-title" className="block text-xs font-medium text-[var(--color-text-subtle)]">
                                Akademiese Titel
                            </label>
                            <select
                                id="profile-title"
                                value={title}
                                onChange={(e) => edit(setTitle)(e.target.value as UserTitle)}
                                className={FIELD_CLASS}
                            >
                                {TITLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Wat 'n gebruiker nie self mag verander nie, bly leesbaar staan */}
                        <div className="pt-4 border-t border-[var(--color-border)] space-y-2.5">
                            <ReadOnlyRows user={user} tags={tags} />
                        </div>

                        {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={requestCancel}
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-60"
                            >
                                Kanselleer
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !dirty || incomplete}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {saving ? 'Stoor…' : 'Stoor'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {justSaved && (
                            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-green)]">
                                <Check size={13} />
                                Profiel gestoor
                            </p>
                        )}

                        <div className="space-y-2.5">
                            <ReadOnlyRows user={user} tags={tags} />
                        </div>

                        <button
                            onClick={startEdit}
                            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity"
                        >
                            <Pencil size={14} />
                            Redigeer Profiel
                        </button>

                        {/* Slegs in die kyk-fase sigbaar */}
                        {calendarStatus && (
                            <div className="pt-4 border-t border-[var(--color-border)]">
                                <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-3">
                                    Kalender-koppelinge
                                </p>
                                <CalendarConnections initialStatus={calendarStatus} />
                            </div>
                        )}

                        <div className="pt-4 border-t border-[var(--color-border)]">
                            <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-1">Gevaarsone</p>
                            <p className="text-xs text-[var(--color-text-subtle)] mb-3">
                                Hierdie aksie is permanent en kan nie ongedaan gemaak word nie.
                            </p>
                            <DeleteAccountSection />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Die velde wat net 'n administrateur kan verander, altyd lees-alleen.
function ReadOnlyRows({ user, tags }: { user: MockUser; tags: NonNullable<MockUser['tags']> }) {
    return (
        <>
            <DetailRow icon={Mail} label="E-pos">
                <span className="text-[var(--color-text)] truncate">{user.email}</span>
            </DetailRow>
            <DetailRow icon={ShieldCheck} label="Rol">
                <Pill tone={getRoleTone(user.role)}>{getRoleLabel(user.role)}</Pill>
            </DetailRow>
            <DetailRow icon={Building2} label="Studiesentrum">
                <span className="text-[var(--color-text)] truncate">{user.studyCenter || 'Onbekend'}</span>
            </DetailRow>
            <DetailRow icon={Activity} label="Status">
                <Pill tone={user.isActive ? 'green' : 'neutral'} dot>
                    {user.isActive ? 'Aktief' : 'Onaktief'}
                </Pill>
            </DetailRow>
            <DetailRow icon={Tag} label="Tags">
                {tags.length === 0 ? (
                    <span className="text-[var(--color-text-subtle)]">Geen</span>
                ) : (
                    <span className="flex flex-wrap justify-end gap-1.5">
                        {tags.map((tag) => (
                            <Pill key={tag} tone={getTagTone(tag)}>{getTagLabel(tag)}</Pill>
                        ))}
                    </span>
                )}
            </DetailRow>
        </>
    );
}

// Een etiket-en-waarde ry, met die etiket links en die waarde regs uitgelyn.
function DetailRow({
    icon: Icon,
    label,
    children,
}: {
    icon: LucideIcon;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm min-w-0">
            <span className="flex items-center gap-2 shrink-0 text-[var(--color-text-subtle)]">
                <Icon size={14} className="shrink-0" />
                {label}
            </span>
            <span className="flex items-center justify-end gap-1.5 min-w-0 text-right">
                {children}
            </span>
        </div>
    );
}
