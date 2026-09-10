// ========== Imports: ==========

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../theme/theme';
import { searchPlaces, getPlaceDetails } from '../api/places';
import type { PlaceSuggestion, PlaceDetails } from '../api/places';

interface AddressAutocompleteInputProps {
    initialAddress?: string;
    onSelect: (details: PlaceDetails | null) => void;
    editable?: boolean;
}

export function AddressAutocompleteInput({ initialAddress, onSelect, editable = true }: AddressAutocompleteInputProps) {
    const colors = useThemeColors();
    const styles = makeStyles(colors);

    const [query, setQuery] = useState(initialAddress ?? '');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [pickError, setPickError] = useState<string | null>(null);
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
        return;
    }

    debounceRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        setIsSearching(true);
        try {
        const results = await searchPlaces(query);
        if (requestId !== requestIdRef.current) return;
        setSuggestions(results);
        } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
        } finally {
        if (requestId === requestIdRef.current) setIsSearching(false);
        }
    }, 400);

    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    }, [query]);

    function handleChange(value: string) {
    setQuery(value);
    setPickError(null);
    onSelect(null);
    }

    async function handlePick(suggestion: PlaceSuggestion) {
    setSuggestions([]);
    setIsResolving(true);
    setPickError(null);
    try {
        const details = await getPlaceDetails(suggestion.description, suggestion.lat, suggestion.lon);
        skipNextSearchRef.current = true;
        setQuery(details.address);
        onSelect(details);
    } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
        const raw = axiosErr?.response?.data?.message;
        const msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(', ') : 'Kon nie adresbesonderhede kry nie.';
        setPickError(msg);
    } finally {
        setIsResolving(false);
    }
    }

    return (
    <View>
        <View style={styles.inputWrapper}>
        <TextInput
            style={styles.textInput}
            placeholder="Soek 'n adres..."
            placeholderTextColor={colors.textSubtle}
            value={query}
            onChangeText={handleChange}
            editable={editable}
            returnKeyType="next"
        />
        {(isSearching || isResolving) && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        )}
        </View>

        {pickError && <Text style={styles.errorText}>{pickError}</Text>}

        {suggestions.length > 0 && (
        <View style={styles.dropdown}>
            {suggestions.map((suggestion, i) => (
            <TouchableOpacity
                key={suggestion.placeId}
                style={[styles.suggestionRow, i === suggestions.length - 1 && styles.suggestionRowLast]}
                onPress={() => handlePick(suggestion)}
            >
                <Feather name="map-pin" size={14} color={colors.textSubtle} />
                <Text style={styles.suggestionText} numberOfLines={1}>{suggestion.description}</Text>
            </TouchableOpacity>
            ))}
        </View>
        )}
    </View>
    );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
    return StyleSheet.create({
    inputWrapper: { justifyContent: 'center' },
    textInput: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        fontWeight: '600',
    },
    spinner: { position: 'absolute', right: 14 },
    errorText: { fontSize: 16, fontWeight: '600', color: colors.red, marginTop: 4 },
    dropdown: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    suggestionRowLast: { borderBottomWidth: 0 },
    suggestionText: { flex: 1, fontSize: 16, color: colors.text },
    });
}
