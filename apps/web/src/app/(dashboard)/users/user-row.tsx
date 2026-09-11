'use client';

// ========== Imports: ==========
import { useState } from 'react';
import { X, Plus, ChevronRight, Check, Loader2 } from 'lucide-react';
import { getRoleLabel, getRoleTone, ALL_USER_TAGS, getTagLabel, getTagTone } from '@/lib/rbac';
import { updateUserNameAction, updateUserTagsAction } from '@/lib/actions/user.actions';
import { Pill } from '@/components/ui/Pill';
import type { UserResponseDto, UserTag } from '@/lib/api/users';
import type { UserRole } from '@/lib/mock-data';

// Dieselfde veldstyl as die redigeer-profiel-skerm, sodat 'n invoerveld oral
// in die stelsel dieselfde lyk.
const FIELD_CLASS =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

interface UserRowProps {
    user: UserResponseDto;
}

export default function UserRow({ user }: UserRowProps) {
    const [open, setOpen]             = useState(false);
    const [tags, setTags]             = useState<UserTag[]>(user.tags);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving]         = useState(false);
    const [error, setError]           = useState<string | null>(null);

    // `saved` is wat op die bediener staan; die twee drafts is wat in die velde
    // getik word. Die ry en die modaal se opskrif wys `saved`, sodat 'n halwe
    // redigering nooit soos 'n gestoorde naam lyk nie.
    const [saved, setSaved]               = useState({ name: user.name, surname: user.surname });
    const [draftName, setDraftName]       = useState(user.name);
    const [draftSurname, setDraftSurname] = useState(user.surname);
    const [nameSaving, setNameSaving]     = useState(false);
    const [nameError, setNameError]       = useState<string | null>(null);
    const [nameSaved, setNameSaved]       = useState(false);

    const availableTags = ALL_USER_TAGS.filter((t) => !tags.includes(t.value));

    const nameDirty =
        draftName.trim() !== saved.name || draftSurname.trim() !== saved.surname;
    const nameIncomplete = !draftName.trim() || !draftSurname.trim();

    // Onvoltooide redigerings word by toemaak weggegooi, nie stilweg behou nie.
    function closeModal() {
        setOpen(false);
        setPickerOpen(false);
        setDraftName(saved.name);
        setDraftSurname(saved.surname);
        setNameError(null);
        setNameSaved(false);
    }

    function editName(setter: (value: string) => void) {
        return (value: string) => {
            setter(value);
            setNameError(null);
            setNameSaved(false);
        };
    }

    async function handleSaveName() {
        setNameSaving(true);
        setNameError(null);
        setNameSaved(false);

        const res = await updateUserNameAction(user.id, {
            name: draftName,
            surname: draftSurname,
        });

        setNameSaving(false);
        if (res.error || !res.user) {
            setNameError(res.error ?? 'Stoor het misluk.');
            return;
        }

        setSaved({ name: res.user.name, surname: res.user.surname });
        setDraftName(res.user.name);
        setDraftSurname(res.user.surname);
        setNameSaved(true);
    }

    async function persistTags(next: UserTag[], previous: UserTag[]) {
        setTags(next);
        setError(null);
        setSaving(true);
        const res = await updateUserTagsAction(user.id, next);
        setSaving(false);
        if (res.error) {
            setError(res.error);
            setTags(previous);
        }
    }

    function addTag(tag: UserTag) {
        setPickerOpen(false);
        void persistTags([...tags, tag], tags);
    }

    function removeTag(tag: UserTag) {
        void persistTags(tags.filter((t) => t !== tag), tags);
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full grid grid-cols-1 md:grid-cols-[1.2fr_1.6fr_1fr_1.2fr_0.8fr] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-[var(--color-bg)] transition-colors text-left group"
            >
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {saved.name} {saved.surname}
                </p>
                <p className="text-sm text-[var(--color-text-subtle)] truncate">
                    {user.email}
                </p>
                <div>
                    <Pill tone={getRoleTone(user.role as UserRole)}>{getRoleLabel(user.role as UserRole)}</Pill>
                </div>
                <p className="text-sm text-[var(--color-text-subtle)] truncate">
                    {user.studyCenter || '—'}
                </p>
                <div className="flex items-center justify-between gap-2">
                    <Pill tone={user.isActive ? 'green' : 'neutral'} dot>
                        {user.isActive ? 'Aktief' : 'Onaktief'}
                    </Pill>
                    <ChevronRight
                        size={16}
                        className="hidden md:block shrink-0 text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                </div>
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={closeModal}
                >
                    <div
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
                            <h3 className="text-sm font-bold text-[var(--color-text)]">
                                {saved.name} {saved.surname}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:bg-[var(--color-border)] transition-colors"
                                aria-label="Maak toe"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Naam -- die enigste veld wat 'n admin hier tik */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-[var(--color-text-subtle)]">Naam</p>

                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={draftName}
                                        maxLength={50}
                                        aria-label="Naam"
                                        placeholder="Naam"
                                        onChange={(e) => editName(setDraftName)(e.target.value)}
                                        className={FIELD_CLASS}
                                    />
                                    <input
                                        type="text"
                                        value={draftSurname}
                                        maxLength={50}
                                        aria-label="Van"
                                        placeholder="Van"
                                        onChange={(e) => editName(setDraftSurname)(e.target.value)}
                                        className={FIELD_CLASS}
                                    />
                                </div>

                                {nameError && <p className="text-xs text-[var(--color-red)]">{nameError}</p>}

                                <div className="flex items-center justify-end gap-3">
                                    {nameSaved && !nameDirty && (
                                        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-green)]">
                                            <Check size={13} />
                                            Naam gestoor
                                        </p>
                                    )}
                                    <button
                                        onClick={handleSaveName}
                                        disabled={nameSaving || !nameDirty || nameIncomplete}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-text)] text-xs font-medium py-1.5 px-4 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                    >
                                        {nameSaving && <Loader2 size={12} className="animate-spin" />}
                                        {nameSaving ? 'Stoor…' : 'Stoor naam'}
                                    </button>
                                </div>
                            </div>

                            {/* Tags -- direk onder die naam */}
                            <div className="pt-4 border-t border-[var(--color-border)]">
                                <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-2">Tags</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {tags.map((tag) => (
                                        <Pill key={tag} tone={getTagTone(tag)}>
                                            {getTagLabel(tag)}
                                            <button
                                                onClick={() => removeTag(tag)}
                                                className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                aria-label={`Verwyder ${getTagLabel(tag)}`}
                                            >
                                                <X size={11} />
                                            </button>
                                        </Pill>
                                    ))}

                                    <div className="relative">
                                        <button
                                            onClick={() => setPickerOpen((v) => !v)}
                                            disabled={availableTags.length === 0 || saving}
                                            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-subtle)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            aria-label="Voeg tag by"
                                        >
                                            <Plus size={14} />
                                        </button>

                                        {pickerOpen && availableTags.length > 0 && (
                                            <div className="absolute left-0 top-8 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                                                {availableTags.map((t) => (
                                                    <button
                                                        key={t.value}
                                                        onClick={() => addTag(t.value)}
                                                        className="w-full text-left px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                                                    >
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
                            </div>

                            {/* Gebruiker-inligting */}
                            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--color-text-subtle)]">E-pos</span>
                                    <span className="text-[var(--color-text)]">{user.email}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-[var(--color-text-subtle)]">Rol</span>
                                    <Pill tone={getRoleTone(user.role as UserRole)}>{getRoleLabel(user.role as UserRole)}</Pill>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--color-text-subtle)]">Studiesentrum</span>
                                    <span className="text-[var(--color-text)]">{user.studyCenter || 'Onbekend'}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-[var(--color-text-subtle)]">Status</span>
                                    <Pill tone={user.isActive ? 'green' : 'neutral'} dot>
                                        {user.isActive ? 'Aktief' : 'Onaktief'}
                                    </Pill>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
