'use client';

// ========== Imports: ==========
import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { searchPlacesAction, getPlaceDetailsAction } from '@/lib/actions/places.actions';
import type { PlaceSuggestion, PlaceDetails } from '@/lib/api/places';

interface AddressAutocompleteInputProps {
    initialAddress?: string;
    onSelect: (details: PlaceDetails | null) => void;
    error?: string;
}

export default function AddressAutocompleteInput({ initialAddress, onSelect, error }: AddressAutocompleteInputProps) {
    const [query, setQuery] = useState(initialAddress ?? '');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [pickError, setPickError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextSearchRef = useRef(false);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        if (query.trim().length < 3) {
            setSuggestions([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            const result = await searchPlacesAction(query);
            setSuggestions(result.suggestions ?? []);
            setIsSearching(false);
        }, 400);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    function handleChange(value: string) {
        setQuery(value);
        setIsOpen(true);
        setPickError(null);
        onSelect(null);
    }

    async function handlePick(suggestion: PlaceSuggestion) {
        setIsOpen(false);
        setIsResolving(true);
        setPickError(null);
        const result = await getPlaceDetailsAction(suggestion.description, suggestion.lat, suggestion.lon);
        setIsResolving(false);
        if (result.details) {
            skipNextSearchRef.current = true;
            setSuggestions([]);
            setQuery(result.details.address);
            onSelect(result.details);
        } else {
            setPickError(result.error ?? 'Kon nie adresbesonderhede kry nie');
        }
    }

    const inputClass = [
        'w-full bg-[var(--color-bg)] border rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)]',
        'placeholder:text-[var(--color-text-subtle)] outline-none transition-colors',
        error
            ? 'border-[var(--color-red)]'
            : 'border-[var(--color-border)] focus:border-[var(--color-primary)]',
    ].join(' ');

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Soek 'n adres..."
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                className={inputClass}
            />
            {(isSearching || isResolving) && (
                <Loader2 size={15} className="animate-spin absolute right-3 top-3 text-[var(--color-text-subtle)]" />
            )}
            {(error || pickError) && <p className="text-xs text-[var(--color-red)] mt-1">{error || pickError}</p>}

            {isOpen && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map((suggestion) => (
                        <li key={suggestion.placeId}>
                            <button
                                type="button"
                                onMouseDown={() => handlePick(suggestion)}
                                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                            >
                                <MapPin size={14} className="shrink-0 text-[var(--color-text-subtle)]" />
                                <span className="truncate">{suggestion.description}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
