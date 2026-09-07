'use client';

// Imports
import { useState, useEffect, useRef, useMemo } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import {
    MONTHS,
    DAYS,
    dayKey,
    todayKey as computeTodayKey,
    yearOf,
    monthOf,
    formatDay,
    formatLong,
    formatRangeLabel,
    isSingleDay,
    selectDay as nextRange,
    drawnRange,
    monthGrid,
    yearOptions,
} from '@/lib/date-range';

// Die paneel se breedte plus die spasie wat ons tussen die paneel en
// die venster se rand wil hou wanneer ons besluit na watter kant dit oopmaak.
const PANEL_WIDTH = 304;
const EDGE_GAP    = 16;

export interface DateRangePickerProps {
    // Begin van die reeks as 'yyyy-mm-dd', of '' vir geen filter nie
    from: string;
    // Einde van die reeks as 'yyyy-mm-dd'. Gelyk aan `from` vir 'n enkel dag
    to: string;
    onChange: (from: string, to: string) => void;
}

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);
    // Die dag waaroor die muis tans sweef, sodat die reeks al voorskou terwyl
    // die gebruiker die tweede dag soek.
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    // Die maand/jaar-wiele wat die dag-rooster vervang wanneer die gebruiker op
    // die opskrif druk.
    const [wheelsOpen, setWheelsOpen] = useState(false);
    // Die kieser sit gewoonlik heel regs in die filterry, waar 'n paneel wat na
    // regs oopmaak by die bladsy se rand sou uitsteek (die dashboard se <main>
    // rol dan horisontaal). Steek dit uit, haak ons die paneel se regterkant aan
    // die knoppie s'n vas sodat dit na links oopmaak en binne die bladsy bly.
    const [alignRight, setAlignRight] = useState(false);
    const containerRef  = useRef<HTMLDivElement>(null);
    const monthItemRef  = useRef<HTMLButtonElement>(null);
    const yearItemRef   = useRef<HTMLButtonElement>(null);

    const today    = useMemo(() => new Date(), []);
    const todayKey = computeTodayKey(today);

    // Die kalender open op die maand van die gekose begin-datum, anders vandag s'n.
    const [viewYear, setViewYear]   = useState(() => (from ? yearOf(from) : today.getFullYear()));
    const [viewMonth, setViewMonth] = useState(() => (from ? monthOf(from) : today.getMonth()));

    useEffect(() => {
        if (!open || !containerRef.current) return;
        const { left, right } = containerRef.current.getBoundingClientRect();
        // Maak links oop as dit regs nie pas nie, maar net solank die paneel dan
        // nie aan die ander kant uitsteek nie.
        setAlignRight(
            left + PANEL_WIDTH + EDGE_GAP > window.innerWidth && right - PANEL_WIDTH >= EDGE_GAP,
        );
    }, [open]);

    // Die wiele begin altyd toe wanneer die paneel oopgaan.
    useEffect(() => {
        if (!open) setWheelsOpen(false);
    }, [open]);

    // Spring dadelik na die gekose maand en jaar sodra die wiele oopmaak, sodat
    // die gebruiker nooit eers hoef te rol om te sien waar hy is nie.
    useEffect(() => {
        if (!wheelsOpen) return;
        monthItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
        yearItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, [wheelsOpen]);

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

    function selectDay(key: string) {
        const next = nextRange(from, to, key);
        onChange(next.from, next.to);
    }

    function clear(e: React.MouseEvent) {
        e.stopPropagation();
        onChange('', '');
        setHoverKey(null);
    }

    const singleDay = isSingleDay(from, to);
    const { from: rangeStart, to: rangeEnd } = drawnRange(from, to, hoverKey);
    const hasRange = Boolean(from);
    const label    = formatRangeLabel(from, to, 'Filter datum');

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
                    'flex items-center gap-2 text-sm rounded-xl px-3 py-2 border transition-colors cursor-pointer',
                    hasRange
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
                ].join(' ')}
            >
                <CalendarRange size={16} className={hasRange ? '' : 'text-[var(--color-text-subtle)]'} />
                <span>{label}</span>
                {hasRange && (
                    <span
                        role="button"
                        tabIndex={0}
                        aria-label="Vee datumfilter uit"
                        title="Vee datumfilter uit"
                        onClick={clear}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange('', '');
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
                    aria-label="Kies 'n datumreeks"
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
                            <div className="grid grid-cols-7" onMouseLeave={() => setHoverKey(null)}>
                                {Array.from({ length: totalCells }).map((_, cellIdx) => {
                                    const day = cellIdx - firstWeekday + 1;
                                    if (day < 1 || day > daysInMonth) {
                                        return <div key={cellIdx} className="h-9" />;
                                    }

                                    const key      = dayKey(viewYear, viewMonth, day);
                                    const isStart  = key === rangeStart;
                                    const isEnd    = Boolean(rangeEnd) && key === rangeEnd;
                                    // Die dae tussen die twee punte kry die ligter blou balk,
                                    // die begin- en einddag self kry die donkerder blou blokkie.
                                    const isBetween = Boolean(rangeStart && rangeEnd && key > rangeStart && key < rangeEnd);
                                    const inRange   = isStart || isEnd || isBetween;

                                    return (
                                        <div
                                            key={cellIdx}
                                            onMouseEnter={() => setHoverKey(key)}
                                            className={[
                                                'h-9 flex items-center justify-center',
                                                inRange ? 'bg-[var(--color-primary-soft)]' : '',
                                                // Rond die balk se punte af sodat dit soos een streep lyk
                                                isStart || (inRange && day === 1) ? 'rounded-l-full' : '',
                                                isEnd || (inRange && day === daysInMonth) ? 'rounded-r-full' : '',
                                            ].join(' ')}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectDay(key)}
                                                aria-label={formatLong(key)}
                                                aria-pressed={inRange}
                                                className={[
                                                    'w-9 h-9 flex items-center justify-center text-sm rounded-full transition-colors cursor-pointer',
                                                    isStart || isEnd
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] font-semibold'
                                                        : isBetween
                                                            ? 'text-[var(--color-text)] hover:bg-[var(--color-primary-soft-hover)]'
                                                            : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]',
                                                    !inRange && key === todayKey
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

                            {/* ── Voetstuk ── */}
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--color-border)]">
                                <span className="text-xs text-[var(--color-text-subtle)]">
                                    {!from
                                        ? 'Kies ’n dag'
                                        : singleDay
                                            ? 'Druk ’n tweede dag vir ’n reeks, of dieselfde dag om af te haal'
                                            : `${formatDay(from, false)} – ${formatDay(to, true)}`}
                                </span>
                                {hasRange && (
                                    <button
                                        type="button"
                                        onClick={() => { onChange('', ''); setHoverKey(null); }}
                                        className="text-xs text-[var(--color-primary)] hover:underline shrink-0 cursor-pointer"
                                    >
                                        Vee uit
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
