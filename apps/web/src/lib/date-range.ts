// Platform-onafhanklike logika agter die datum-reeks-kieser.
//
// LET WEL: hierdie lêer word gespieël in apps/mobile/src/lib/date-range.ts.
// Hou die twee identies -- die repo het nie npm-workspaces nie, en 'n gedeelde
// pakket sou Metro se watchFolders plus die EAS- en Docker-boue raak, wat nie
// die moeite werd is vir hierdie bietjie kode nie. Verander jy die een, verander
// die ander saam.

export const MONTHS = [
    'Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie',
    'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember',
];

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

export const DAYS = ['So', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Sa'];

// Hoeveel jaar weerskante van vandag die jaar-wiel aanbied.
const YEAR_SPAN = 5;

// Datums beweeg hier deur as 'yyyy-mm-dd'-sleutels, nooit as Date-objekte nie.
// So bly alles in die gebruiker se eie kalenderdag en kan ons twee dae met 'n
// gewone string-vergelyking rangskik -- geen tydsone-verskuiwing nie.
export function dayKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayKey(now: Date = new Date()): string {
    return dayKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function yearOf(key: string): number {
    return Number(key.slice(0, 4));
}

export function monthOf(key: string): number {
    return Number(key.slice(5, 7)) - 1;
}

export function formatDay(key: string, withYear: boolean): string {
    const [y, m, d] = key.split('-').map(Number);
    return withYear ? `${d} ${MONTHS_SHORT[m - 1]} ${y}` : `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatLong(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Die opskrif op die knoppie: leeg, een dag, of 'n reeks. Die jaar val by die
// eerste datum weg as albei in dieselfde jaar is.
export function formatRangeLabel(from: string, to: string, emptyLabel: string): string {
    if (!from) return emptyLabel;
    if (!to || to === from) return formatDay(from, true);
    return `${formatDay(from, from.slice(0, 4) !== to.slice(0, 4))} – ${formatDay(to, true)}`;
}

// 'n Enkel gekose dag word as begin EN einde gehou (from === to), sodat die dag
// self dadelik 'n volwaardige filter is en nie eers op 'n tweede klik wag nie.
// Daardie toestand bly oop vir uitbreiding.
export function isSingleDay(from: string, to: string): boolean {
    return Boolean(from) && from === to;
}

export interface DateRange {
    from: string;
    to: string;
}

// Klik-gedrag:
//   niks gekies    -> die dag word begin en einde
//   een dag gekies -> 'n ander dag brei uit na 'n reeks (in enige volgorde
//                     gekies, ons rangskik hulle), dieselfde dag haal af
//   volle reeks    -> 'n punt weer druk haal daardie punt af en laat die ander
//                     een as enkeldag oor, enige ander dag begin oor
export function selectDay(from: string, to: string, key: string): DateRange {
    if (isSingleDay(from, to)) {
        if (key === from) return { from: '', to: '' };
        return key < from ? { from: key, to: from } : { from, to: key };
    }

    if (from && to) {
        if (key === from) return { from: to, to };
        if (key === to)   return { from, to: from };
    }

    return { from: key, to: key };
}

// Die reeks wat geteken moet word. Is net een dag gekies, wys ons die reeks wat
// sou ontstaan as die gebruiker op die dag onder die wyser klik.
export function drawnRange(from: string, to: string, previewKey: string | null): DateRange {
    const preview = isSingleDay(from, to) && previewKey && previewKey !== from ? previewKey : null;
    if (!preview) return { from, to };
    return preview < from ? { from: preview, to: from } : { from, to: preview };
}

export interface MonthGrid {
    firstWeekday: number;
    daysInMonth: number;
    totalCells: number;
}

export function monthGrid(year: number, month: number): MonthGrid {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    return {
        firstWeekday,
        daysInMonth,
        totalCells: Math.ceil((firstWeekday + daysInMonth) / 7) * 7,
    };
}

// Die jare wat die jaar-wiel aanbied. Die tans-vertoonde jaar word altyd
// ingesluit, ook al val dit buite die normale venster.
export function yearOptions(viewYear: number, now: Date = new Date()): number[] {
    const current = now.getFullYear();
    const first   = Math.min(current - YEAR_SPAN, viewYear);
    const last    = Math.max(current + YEAR_SPAN, viewYear);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// Skakel die gekose dae om na die grense wat die backend se from/to verwag: van
// die oggend van die eerste dag tot die laaste oomblik van die laaste dag, in
// die gebruiker se eie tydsone. Is net een dag gekies, is daardie dag albei
// grense. Niks gekies nie gee null terug.
export function toIsoRange(from: string, to: string): { from: string; to: string } | null {
    if (!from) return null;
    return {
        from: new Date(`${from}T00:00:00.000`).toISOString(),
        to:   new Date(`${to || from}T23:59:59.999`).toISOString(),
    };
}
