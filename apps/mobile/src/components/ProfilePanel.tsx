// ========== Imports: ==========
import { useEffect, useMemo, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/auth.store';
import { useThemeColors, type ThemeColors } from '../theme/theme';
import { typography } from '../theme/typography';
import { getRoleLabel } from '../lib/rbac';
import { updateUser, deleteAccount, getTagLabel, UserTitle } from '../api/users';
import {
    getCalendarStatus,
    getGoogleConnectUrl,
    getMicrosoftConnectUrl,
    disconnectGoogleCalendar,
    disconnectMicrosoftCalendar,
    type CalendarStatus,
} from '../api/calendar';
import { apiClient } from '../api/client';

export type Phase = 'view' | 'edit';

type CalendarProvider = 'google' | 'microsoft';

const TITLE_OPTIONS: Array<{ value: UserTitle; label: string }> = [
    { value: UserTitle.NONE, label: '(Geen titel)' },
    { value: UserTitle.DR,   label: 'Dr.' },
    { value: UserTitle.PROF, label: 'Prof.' },
    { value: UserTitle.LEC,  label: 'Lec.' },
    { value: UserTitle.MNR,  label: 'Mnr.' },
    { value: UserTitle.MEV,  label: 'Mev.' },
    { value: UserTitle.MX,   label: 'Mx.' },
];

interface Props {
    onPhaseChange?: (phase: Phase) => void;
}

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
export function ProfilePanel({ onPhaseChange }: Props) {
    const colors = useThemeColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const user = useAuthStore((s) => s.user);

    const [phase, setPhaseState] = useState<Phase>('view');

    const savedTitle = (user?.title as UserTitle) ?? UserTitle.NONE;
    const [name, setName] = useState(user?.name ?? '');
    const [surname, setSurname] = useState(user?.surname ?? '');
    const [title, setTitle] = useState<UserTitle>(savedTitle);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
    const [calendarBusy, setCalendarBusy] = useState<CalendarProvider | null>(null);
    const [calendarError, setCalendarError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getCalendarStatus()
            .then((result) => { if (active) setCalendarStatus(result); })
            .catch(() => { /* Laat die kaart eenvoudig weg as die status nie laai nie */ });
        return () => { active = false; };
    }, []);

    if (!user) return null;

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
        setName(user!.name);
        setSurname(user!.surname);
        setTitle(savedTitle);
        setError(null);
        setPhase('view');
    }

    // Niks getik nie -- dan is daar niks om te bevestig nie, en gaan ons reguit terug.
    function requestCancel() {
        if (!dirty) {
            discardEdit();
            return;
        }
        Alert.alert(
            'Gooi veranderinge weg?',
            'Jy het veranderinge gemaak wat nog nie gestoor is nie. As jy kanselleer, gaan hulle verlore.',
            [
                { text: 'Hou aan redigeer', style: 'cancel' },
                { text: 'Gooi weg', style: 'destructive', onPress: discardEdit },
            ],
        );
    }

    const trimmedName = name.trim();
    const trimmedSurname = surname.trim();
    const dirty =
        trimmedName !== user.name || trimmedSurname !== user.surname || title !== savedTitle;
    const canSave = dirty && !!trimmedName && !!trimmedSurname && !saving;

    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const updated = await updateUser(user!.id, {
                name: trimmedName,
                surname: trimmedSurname,
                title,
            });
            useAuthStore.setState({ user: updated });
            setName(updated.name);
            setSurname(updated.surname);
            setJustSaved(true);
            setPhase('view');
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Kon nie stoor nie');
        } finally {
            setSaving(false);
        }
    }

    async function connectCalendar(provider: CalendarProvider) {
        setCalendarBusy(provider);
        setCalendarError(null);
        try {
            const authUrl = provider === 'google'
                ? await getGoogleConnectUrl()
                : await getMicrosoftConnectUrl();

            const redirectUri = Linking.createURL('calendar-callback');
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success') {
                setCalendarStatus(await getCalendarStatus());
            }
        } catch {
            setCalendarError(
                provider === 'google'
                    ? 'Kon nie met Google Kalender koppel nie.'
                    : 'Kon nie met Outlook Kalender koppel nie.',
            );
        } finally {
            setCalendarBusy(null);
        }
    }

    async function disconnectCalendar(provider: CalendarProvider) {
        setCalendarBusy(provider);
        setCalendarError(null);
        try {
            if (provider === 'google') {
                await disconnectGoogleCalendar();
                setCalendarStatus((prev) => prev && { ...prev, google: false, googleAccountEmail: null });
            } else {
                await disconnectMicrosoftCalendar();
                setCalendarStatus((prev) => prev && { ...prev, microsoft: false, microsoftAccountEmail: null });
            }
        } catch {
            setCalendarError('Kon nie ontkoppel nie. Probeer asseblief weer.');
        } finally {
            setCalendarBusy(null);
        }
    }

    function handleDeleteAccount() {
        Alert.alert(
            'Verwyder rekening',
            'Jou rekening en persoonlike data word permanent verwyder. Enige aktiewe RSVP\'s word gekanselleer. Hierdie aksie kan nie ongedaan gemaak word nie.',
            [
                { text: 'Kanselleer', style: 'cancel' },
                {
                    text: 'Verwyder rekening',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await deleteAccount();
                            await apiClient.clearTokens();
                            useAuthStore.setState({ user: null });
                        } catch (err: any) {
                            setDeleting(false);
                            Alert.alert('Kon nie verwyder nie', err?.response?.data?.message ?? 'Probeer asseblief weer.');
                        }
                    },
                },
            ],
        );
    }

    const initials = `${user.name.charAt(0)}${user.surname.charAt(0)}`.toUpperCase();
    const displayName = phase === 'edit'
        ? [title, name, surname].filter((part) => part.trim()).join(' ')
        : [user.title, user.name, user.surname].filter(Boolean).join(' ');

    return (
        <View>
            {/* Kop -- bly in albei fases staan */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <Text style={styles.name} numberOfLines={2}>{displayName || '—'}</Text>
                <View style={[styles.badge, { backgroundColor: colors.infoBg }]}>
                    <Text style={[styles.badgeText, { color: colors.info }]}>{getRoleLabel(user.role)}</Text>
                </View>
            </View>

            <View style={styles.body}>
                {phase === 'edit' ? (
                    <>
                        <Text style={styles.fieldLabel}>Naam</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={(v) => { setName(v); setError(null); }}
                            maxLength={50}
                            placeholder="Naam"
                            placeholderTextColor={colors.textSubtle}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Van</Text>
                        <TextInput
                            style={styles.input}
                            value={surname}
                            onChangeText={(v) => { setSurname(v); setError(null); }}
                            maxLength={50}
                            placeholder="Van"
                            placeholderTextColor={colors.textSubtle}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Akademiese Titel</Text>
                        <View style={styles.titleGroup}>
                            {TITLE_OPTIONS.map((opt) => {
                                const active = title === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value || 'none'}
                                        style={[styles.row, active && styles.rowActive]}
                                        onPress={() => { setTitle(opt.value); setError(null); }}
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Text style={styles.rowLabel}>{opt.label}</Text>
                                        <View style={[styles.radio, active && styles.radioActive]}>
                                            <View style={[styles.radioDot, active && styles.radioDotActive]} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Wat 'n gebruiker nie self mag verander nie, bly leesbaar staan */}
                        <View style={styles.detailsBlock}>
                            <ReadOnlyRows user={user} colors={colors} />
                        </View>

                        {error && <Text style={styles.errorText}>{error}</Text>}

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.cancelBtn, saving && styles.disabled]}
                                onPress={requestCancel}
                                disabled={saving}
                                accessibilityLabel="Kanselleer"
                            >
                                <Text style={styles.cancelText}>Kanselleer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, !canSave && styles.disabled]}
                                onPress={handleSave}
                                disabled={!canSave}
                                accessibilityLabel="Stoor"
                            >
                                {saving
                                    ? <ActivityIndicator color={colors.primaryText} />
                                    : <Text style={styles.saveText}>Stoor</Text>}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        {justSaved && <Text style={styles.successText}>Profiel gestoor.</Text>}

                        <ReadOnlyRows user={user} colors={colors} />

                        <TouchableOpacity style={styles.editBtn} onPress={startEdit} accessibilityLabel="Redigeer profiel">
                            <Feather name="edit-2" size={14} color={colors.primaryText} />
                            <Text style={styles.editBtnText}>Redigeer Profiel</Text>
                        </TouchableOpacity>

                        {/* Slegs in die kyk-fase sigbaar */}
                        {calendarStatus && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Kalender-koppelinge</Text>
                                <CalendarRow
                                    label="Google Kalender"
                                    connected={calendarStatus.google}
                                    account={calendarStatus.googleAccountEmail}
                                    busy={calendarBusy === 'google'}
                                    onPress={() => (calendarStatus.google ? disconnectCalendar('google') : connectCalendar('google'))}
                                    colors={colors}
                                    styles={styles}
                                />
                                <CalendarRow
                                    label="Outlook Kalender"
                                    connected={calendarStatus.microsoft}
                                    account={calendarStatus.microsoftAccountEmail}
                                    busy={calendarBusy === 'microsoft'}
                                    onPress={() => (calendarStatus.microsoft ? disconnectCalendar('microsoft') : connectCalendar('microsoft'))}
                                    colors={colors}
                                    styles={styles}
                                />
                                {calendarError && <Text style={styles.calendarError}>{calendarError}</Text>}
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Gevaarsone</Text>
                            <Text style={styles.sectionHint}>
                                Hierdie aksie is permanent en kan nie ongedaan gemaak word nie.
                            </Text>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={handleDeleteAccount}
                                disabled={deleting}
                                accessibilityLabel="Verwyder my rekening"
                            >
                                {deleting
                                    ? <ActivityIndicator color={colors.red} size="small" />
                                    : <Text style={styles.deleteBtnText}>Verwyder my rekening</Text>}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

// Die velde wat net 'n administrateur kan verander, altyd lees-alleen.
function ReadOnlyRows({
    user,
    colors,
}: {
    user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
    colors: ThemeColors;
}) {
    return (
        <View>
            <DetailLine label="E-pos" value={user.email} colors={colors} />
            <DetailLine label="Rol" value={getRoleLabel(user.role)} colors={colors} />
            <DetailLine label="Studiesentrum" value={user.studyCenter || '—'} colors={colors} />
            <DetailLine label="Status" value={user.isActive ? 'Aktief' : 'Onaktief'} colors={colors} />
            <DetailLine
                label="Tags"
                value={user.tags.length ? user.tags.map(getTagLabel).join(', ') : 'Geen'}
                colors={colors}
                isLast
            />
        </View>
    );
}

function DetailLine({
    label, value, colors, isLast,
}: {
    label: string; value: string; colors: ThemeColors; isLast?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 10,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: colors.border,
            }}
        >
            <Text style={{ ...typography.caption, color: colors.textSubtle }}>{label}</Text>
            <Text
                style={{ ...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right' }}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
}

function CalendarRow({
    label, connected, account, busy, onPress, colors, styles,
}: {
    label: string;
    connected: boolean;
    account: string | null;
    busy: boolean;
    onPress: () => void;
    colors: ThemeColors;
    styles: ReturnType<typeof makeStyles>;
}) {
    return (
        <View style={styles.calendarRow}>
            <View style={styles.calendarInfo}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.calendarSub} numberOfLines={1}>
                    {connected ? account : 'Nie gekoppel nie'}
                </Text>
            </View>
            {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
            ) : (
                <TouchableOpacity
                    style={[styles.calendarBtn, connected && styles.calendarBtnConnected]}
                    onPress={onPress}
                    accessibilityLabel={`${connected ? 'Ontkoppel' : 'Koppel'} ${label}`}
                >
                    <Text style={[styles.calendarBtnText, connected && styles.calendarBtnTextConnected]}>
                        {connected ? 'Ontkoppel' : 'Koppel'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        header: {
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 22,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        avatar: {
            width: 64, height: 64, borderRadius: 999,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        avatarText: { color: colors.primaryText, fontSize: 22, fontWeight: '900' },
        name: { ...typography.subtitle, color: colors.text, marginTop: 10, textAlign: 'center' },
        badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
        badgeText: { ...typography.micro },

        body: { paddingHorizontal: 16, paddingVertical: 14 },

        fieldLabel: { ...typography.caption, color: colors.textSubtle, marginBottom: 6 },
        input: {
            ...typography.body,
            color: colors.text,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },

        titleGroup: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: 'hidden',
        },
        row: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 12, paddingVertical: 12,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
        },
        rowActive: { backgroundColor: colors.background },
        rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
        radio: {
            width: 22, height: 22, borderRadius: 999, borderWidth: 2,
            borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
        },
        radioActive: { borderColor: colors.primary },
        radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: 'transparent' },
        radioDotActive: { backgroundColor: colors.primary },

        detailsBlock: { marginTop: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },

        errorText: { color: colors.red, ...typography.body, marginTop: 12, textAlign: 'center' },
        successText: { color: colors.success, ...typography.body, marginBottom: 10, textAlign: 'center' },

        actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
        cancelBtn: {
            flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
        },
        cancelText: { ...typography.body, color: colors.text, fontWeight: '800' },
        saveBtn: {
            flex: 1, backgroundColor: colors.primary, borderRadius: 12,
            paddingVertical: 13, alignItems: 'center',
        },
        saveText: { color: colors.primaryText, fontSize: 15, fontWeight: '800' },
        disabled: { opacity: 0.5 },

        editBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, marginTop: 16,
        },
        editBtnText: { color: colors.primaryText, fontSize: 15, fontWeight: '800' },

        section: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
        sectionLabel: { ...typography.caption, color: colors.textSubtle, marginBottom: 8 },
        sectionHint: { ...typography.caption, color: colors.textSubtle, fontWeight: '500', marginBottom: 10 },

        calendarRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, paddingVertical: 10,
        },
        calendarInfo: { flex: 1 },
        calendarSub: { ...typography.caption, color: colors.textSubtle, marginTop: 2, fontWeight: '500' },
        calendarBtn: {
            borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
            paddingHorizontal: 14, paddingVertical: 8,
        },
        calendarBtnConnected: { borderColor: colors.border },
        calendarBtnText: { ...typography.caption, color: colors.primary, fontWeight: '800' },
        calendarBtnTextConnected: { color: colors.textSubtle },
        calendarError: { ...typography.caption, color: colors.red, paddingTop: 8 },

        deleteBtn: {
            alignItems: 'center', borderWidth: 1, borderColor: colors.red,
            borderRadius: 12, paddingVertical: 12,
        },
        deleteBtnText: { ...typography.body, color: colors.red },
    });
}
