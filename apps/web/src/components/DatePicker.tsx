'use client';

// Imports
import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import {
    MONTHS,
    DAYS,
    dayKey,
    todayKey as computeTodayKey,
    yearOf,
    monthOf,
    formatDay,
    formatLong,
    monthGrid,
    yearOptions,
} from '@/lib/date-range';

// Die paneel se breedte plus die spasie wat ons tussen die paneel en
// die venster se rand wil hou wanneer ons besluit na watter kant dit oopmaak.
const PANEL_WIDTH = 304;
const EDGE_GAP    = 16;

export interface DatePickerProps {
    // Gekose dag as 'yyyy-mm-dd', of '' vir geen keuse nie
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'Kies datum' }: DatePickerProps) {
    const [open, setOpen] = useState(false);
    // Die maand/jaar-wiele wat die dag-rooster vervang wanneer die gebruiker op
    // die opskrif druk.
    const [wheelsOpen, setWheelsOpen] = useState(false);
    // Sien DateRangePicker: haak die paneel se regterkant aan die knoppie s'n vas
    // sodat dit binne die bladsy bly as dit regs sou uitsteek.
    const [alignRight, setAlignRight] = useState(false);
    const containerRef  = useRef<HTMLDivElement>(null);
    const monthItemRef  = useRef<HTMLButtonElement>(null);
    const yearItemRef   = useRef<HTMLButtonElement>(null);

    const today    = useMemo(() => new Date(), []);
    const todayKey = computeTodayKey(today);

    // Die kalender open op die maand van die gekose dag, anders vandag s'n.
    const [viewYear, setViewYear]   = useState(() => (value ? yearOf(value) : today.getFullYear()));
    const [viewMonth, setViewMonth] = useState(() => (value ? monthOf(value) : today.getMonth()));

    useEffect(() => {
        if (!value) return;
        setViewYear(yearOf(value));
        setViewMonth(monthOf(value));
    }, [value]);

    useEffect(() => {
        if (!open || !containerRef.current) return;
        const { left, right } = containerRef.current.getBoundingClientRect();
        setAlignRight(
            left + PANEL_WIDTH + EDGE_GAP > window.innerWidth && right - PANEL_WIDTH >= EDGE_GAP,
        );
    }, [open]);

    useEffect(() => {
        if (!open) setWheelsOpen(false);
    }, [open]);

    useEffect(() => {
        if (!wheelsOpen) return;
        monthItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
        yearItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, [wheelsOpen, viewMonth, viewYear]);

    // Maak toe met 'n klik buite of met Escape.
    useEffect(() => {
        if (!open) return;

        function onPointerDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const { firstWeekday, daysInMonth, totalCells } = monthGrid(viewYear, viewMonth);
    const years = yearOptions(viewYear, today);

    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    }

    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    }

    // Anders as die reeks-kieser is een klik hier klaar -- daar is geen tweede
    // dag om te kies nie, so die paneel maak dadelik toe.
    function selectDay(key: string) {
        onChange(key);
        setOpen(false);
    }

    function clear(e: React.MouseEvent) {
        e.stopPropagation();
        onChange('');
    }

    const hasValue = Boolean(value);
    const label    = hasValue ? formatDay(value, true) : placeholder;

    const wheelItemClass = (selected: boolean) => [
        'w-full px-3 py-2.5 rounded-lg text-sm text-left font-medium transition-colors cursor-pointer',
        selected
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]',
    ].join(' ');

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={[
                    'w-full flex items-center gap-2 text-sm rounded-xl px-3 py-2 border transition-colors cursor-pointer',
                    hasValue
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
                ].join(' ')}
            >
                <Calendar size={16} className={hasValue ? '' : 'text-[var(--color-text-subtle)]'} />
                <span className="flex-1 text-left">{label}</span>
                {hasValue && (
                    <span
                        role="button"
                        tabIndex={0}
                        aria-label="Maak datum skoon"
                        title="Maak datum skoon"
                        onClick={clear}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange('');
                            }
                        }}
                        className="ml-0.5 -mr-1 p-0.5 rounded hover:bg-[var(--color-primary-soft-hover)] transition-colors"
                    >
                        <X size={14} />
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Kies 'n datum"
                    className={[
                        'absolute z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)]',
                        alignRight ? 'right-0' : 'left-0',
                        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg p-3',
                    ].join(' ')}
                >
                    {/* ── Maand-navigasie. Die opskrif self maak die wiele oop ── */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={prevMonth}
                            aria-label="Vorige maand"
                            className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setWheelsOpen((w) => !w)}
                            aria-expanded={wheelsOpen}
                            aria-label="Kies maand en jaar"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                        >
                            {MONTHS[viewMonth]} {viewYear}
                            <ChevronDown
                                size={14}
                                className={[
                                    'text-[var(--color-text-subtle)] transition-transform duration-150',
                                    wheelsOpen ? 'rotate-180' : '',
                                ].join(' ')}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={nextMonth}
                            aria-label="Volgende maand"
                            className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {wheelsOpen ? (
                        /* ── Twee rolwiele: maand links, jaar regs ── */
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="max-h-64 overflow-y-auto p-1 rounded-xl border border-[var(--color-border)]">
                                    {MONTHS.map((name, index) => {
                                        const selected = index === viewMonth;
                                        return (
                                            <button
                                                key={name}
                                                ref={selected ? monthItemRef : undefined}
                                                type="button"
                                                onClick={() => setViewMonth(index)}
                                                className={wheelItemClass(selected)}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1 rounded-xl border border-[var(--color-border)]">
                                    {years.map((year) => {
                                        const selected = year === viewYear;
                                        return (
                                            <button
                                                key={year}
                                                ref={selected ? yearItemRef : undefined}
                                                type="button"
                                                onClick={() => setViewYear(year)}
                                                className={wheelItemClass(selected)}
                                            >
                                                {year}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWheelsOpen(false)}
                                className="w-full mt-2 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                Klaar
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-7 mb-1">
                                {DAYS.map((d) => (
                                    <div key={d} className="py-1 text-center text-[11px] font-semibold text-[var(--color-text-subtle)]">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* ── Dae ── */}
                            <div className="grid grid-cols-7">
                                {Array.from({ length: totalCells }).map((_, cellIdx) => {
                                    const day = cellIdx - firstWeekday + 1;
                                    if (day < 1 || day > daysInMonth) {
                                        return <div key={cellIdx} className="h-9" />;
                                    }

                                    const key        = dayKey(viewYear, viewMonth, day);
                                    const isSelected = key === value;

                                    return (
                                        <div key={cellIdx} className="h-9 flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => selectDay(key)}
                                                aria-label={formatLong(key)}
                                                aria-pressed={isSelected}
                                                className={[
                                                    'w-9 h-9 flex items-center justify-center text-sm rounded-full transition-colors cursor-pointer',
                                                    isSelected
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] font-semibold'
                                                        : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]',
                                                    !isSelected && key === todayKey
                                                        ? 'ring-1 ring-inset ring-[var(--color-primary)] font-semibold'
                                                        : '',
                                                ].join(' ')}
                                            >
                                                {day}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
