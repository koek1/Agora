'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function RsvpDateFilter() {
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';

    function updateParam(key: 'dateFrom' | 'dateTo', value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    return (
        <>
            <input
                type="date"
                value={dateFrom}
                onChange={(e) => updateParam('dateFrom', e.target.value)}
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] outline-none"
            />
            <span className="text-xs text-[var(--color-text-subtle)]">tot</span>
            <input
                type="date"
                value={dateTo}
                onChange={(e) => updateParam('dateTo', e.target.value)}
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] outline-none"
            />
        </>
    );
}