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
    const [searchError, setSearchError] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextSearchRef = useRef(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        if (query.trim().length < 3) {
            setSuggestions([]);
            setSearchError(null);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            const requestId = ++requestIdRef.current;
            setIsSearching(true);
            const result = await searchPlacesAction(query);
            if (requestId !== requestIdRef.current) return; // 'n nuwer soektog het intussen begin -- ignoreer hierdie stadige respons
            setSuggestions(result.suggestions ?? []);
            setSearchError(result.suggestions ? null : (result.error ?? 'Kon nie adresse soek nie'));
            setActiveIndex(-1);
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

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                handlePick(suggestions[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
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
                role="combobox"
                aria-expanded={isOpen && suggestions.length > 0}
                aria-controls="address-suggestion-list"
                aria-activedescendant={activeIndex >= 0 ? `address-suggestion-${activeIndex}` : undefined}
                autoComplete="off"
                placeholder="Soek 'n adres..."
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                onKeyDown={handleKeyDown}
                className={inputClass}
            />
            {(isSearching || isResolving) && (
                <Loader2 size={15} className="animate-spin absolute right-3 top-3 text-[var(--color-text-subtle)]" />
            )}
            {(error || pickError || searchError) && (
                <p className="text-xs text-[var(--color-red)] mt-1">{error || pickError || searchError}</p>
            )}

            {isOpen && suggestions.length > 0 && (
                <ul id="address-suggestion-list" role="listbox" className="absolute z-10 mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map((suggestion, i) => (
                        <li key={suggestion.placeId} id={`address-suggestion-${i}`} role="option" aria-selected={i === activeIndex}>
                            <button
                                type="button"
                                onMouseDown={() => handlePick(suggestion)}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-[var(--color-text)] transition-colors ${
                                    i === activeIndex ? 'bg-[var(--color-bg)]' : 'hover:bg-[var(--color-bg)]'
                                }`}
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
