import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker'
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useThemeColors, useIsDark } from '../theme/theme';
import { MONTHS_SHORT_AF } from '../lib/event-status';
import { RSVP_STATUS_LABELS, RSVP_STATUS_ICONS, getRsvpStatusColors } from '../lib/rsvp-status';
import {
  getMyRsvps,
  cancelRsvp,
  getRsvpQrDataUri,
  type RsvpWithEvent,
  type RsvpStatus,
} from '../api/rsvp';
import { ScreenHeader } from '../components/ScreenHeader';
import { typography } from '../theme/typography';
import { takeMyRsvpsPrefetch } from '../lib/prefetch';
import { useAuthStore } from '../stores/auth.store';


export function RsvpScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDark = useIsDark();

  const [filter, setFilter] = useState<RsvpStatus | 'alles'>('alles');

  const [rsvps, setRsvps] = useState<RsvpWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // QR per inskrywing
  const [openQrId, setOpenQrId] = useState<string | null>(null);
  const [qrUriById, setQrUriById] = useState<Record<string, string>>({});
  const [qrLoadingId, setQrLoadingId] = useState<string | null>(null);

  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);
  // Kaartjie-afskrifte per inskrywing, vir "Stoor Kaartjie"
  const ticketRefs = useRef<Record<string, ViewShot | null>>({});
  const user = useAuthStore((s) => s.user);
  const attendeeName = user ? `${user.name} ${user.surname}` : '';

  // Almal (ook ADMIN/DOSENT) sien hier net hul eie RSVPs -- funksie-bestuur
  // (Bestuur RSVPs / QR Skandeerder) sit reeds op elke funksie se eie skerm.
  // Gekanselleerde RSVPs word nooit gewys nie (nie net dié wat in-app gekanselleer
  // is nie, ook enige uit 'n vorige sessie).
  // Die datumreeks filter nou by die BACKEND (sien rsvp.service.ts se findMyRsvps) nie plaaslik nie
  const fetchRsvps = useCallback((active: { current: boolean }) => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const hasDateFilter = !!(dateFrom || dateTo);
        // Die prefetch-kas is net vir die ongefiltreerde standaardlys -- as 'n
        // datumfilter aktief is, moet ons regtig 'n vars, gefiltreerde versoek stuur.
        const prefetched = hasDateFilter ? null : takeMyRsvpsPrefetch();
        const data = await (prefetched ?? getMyRsvps(
          dateFrom ? dateFrom.toISOString() : undefined,
          dateTo ? dateTo.toISOString() : undefined,
        ));
        if (active.current) setRsvps(data.filter((r) => r.status !== 'GEKANSELLEER'));
      } catch {
        if (active.current) setLoadError('Kon nie jou RSVPs laai nie.');
      } finally {
        if (active.current) setLoading(false);
      }
    })();
  }, [dateFrom, dateTo]);

  // Laai elke keer wat die oortjie fokus kry, sodat 'n vars kaartjie-aankoop
  // of -kansellasie altyd raakgesien word.
  useFocusEffect(
    useCallback(() => {
      const active = { current: true };
      fetchRsvps(active);
      return () => { active.current = false; };
    }, [fetchRsvps]),
  );

  // Teks-soek bly plaaslik (backend het nie teks-soek nie) datum is reeds
  // deur die backend gefiltreer teen hierdie punt.
  const filteredRsvps = useMemo(
    () => rsvps
      .filter((r) => filter === 'alles' || r.status === filter)
      .filter((r) => !search || (r.event?.title ?? '').toLowerCase().includes(search.toLowerCase())),
    [rsvps, filter, search],
  );

  async function toggleQr(rsvpId: string) {
    if (openQrId === rsvpId) {
      setOpenQrId(null);
      return;
    }
    setOpenQrId(rsvpId);
    if (qrUriById[rsvpId]) return; // klaar gelaai;
    setQrLoadingId(rsvpId);
    try {
      const uri = await getRsvpQrDataUri(rsvpId);
      setQrUriById((prev) => ({ ...prev, [rsvpId]: uri }));
    } catch {
      Alert.alert('QR-kode', 'Kon nie die QR-kode laai nie. Probeer asseblief weer.');
      setOpenQrId(null);
    } finally {
      setQrLoadingId(null);
    }
  }

  async function handleShareTicket(rsvpId: string) {
    const ref = ticketRefs.current[rsvpId];
    if (!ref?.capture) return;
    try {
      const uri = await ref.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Stoor of deel jou kaartjie' });
      }
    } catch {
      Alert.alert('Kaartjie', 'Kon nie die kaartjie skep nie. Probeer asseblief weer.');
    }
  }

  function handleCancelRsvp(rsvpId: string, eventTitle: string) {
    Alert.alert(
      'Kanselleer RSVP',
      `Is jy seker jy wil jou RSVP vir "${eventTitle}" kanselleer?`,
      [
        { text: 'Nee', style: 'cancel' },
        {
          text: 'Ja', style: 'destructive',
          onPress: async () => {
            setCancelingId(rsvpId);
            try {
              await cancelRsvp(rsvpId);
              setRsvps((prev) => prev.filter((r) => r._id !== rsvpId));
            } catch {
              Alert.alert('Kanselleer', 'Kon nie die RSVP kanselleer nie. Probeer asseblief weer.');
            } finally {
              setCancelingId(null);
            }
          }
        }
      ]
    )
  }

  function formatDate(dateStr: string): { day: number; month: string } {
    const d = new Date(dateStr);
    return { day: d.getDate(), month: MONTHS_SHORT_AF[d.getMonth()] };
  }

  function formatPickerLabel(d: Date | null, fallback: string): string {
    if (!d) return fallback;
    return d.toLocaleDateString('af-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="My RSVPs"
        subtitle={`${rsvps.length} inskrywing${rsvps.length !== 1 ? 's' : ''}`}
      />

      {/* Soekveld */}
      <View style={styles.searchRow}>
        <Feather name="search" size={14} color={colors.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder="Soek volgens titel..."
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Soek RSVPs volgens geleentheidstitel"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Maak soekterm skoon">
            <Feather name="x" size={14} color={colors.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['alles', 'BEVESTIG', 'HANGENDE'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              filter === s && styles.chipActive,
            ]}
            onPress={() => setFilter(s)}
            accessibilityLabel={s === 'alles' ? 'Alle RSVPs' : RSVP_STATUS_LABELS[s]}
            accessibilityState={{ selected: filter === s }}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s === 'alles' ? 'Alles' : RSVP_STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Datumreeks-filter */}
      <View style={styles.dateFilterRow}>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowPicker('from')}
          accessibilityLabel="Datum vanaf"
        >
          <Feather name="calendar" size={13} color={colors.textSubtle} />
          <Text style={styles.dateBtnText}>{formatPickerLabel(dateFrom, 'Vanaf')}</Text>
        </TouchableOpacity>

        <Text style={styles.dateSep}>tot</Text>

        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowPicker('to')}
          accessibilityLabel="Datum tot"
        >
          <Feather name="calendar" size={13} color={colors.textSubtle} />
          <Text style={styles.dateBtnText}>{formatPickerLabel(dateTo, 'Tot')}</Text>
        </TouchableOpacity>

        {(dateFrom || dateTo) && (
          <TouchableOpacity
            style={styles.clearDatesBtn}
            onPress={() => { setDateFrom(null); setDateTo(null); }}
            accessibilityLabel="Maak datumfilter skoon"
          >
            <Feather name="x" size={13} color={colors.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {showPicker && (
        <DateTimePicker
          value={(showPicker === 'from' ? dateFrom : dateTo) ?? new Date()}
          mode="date"
          display="calendar"
          onChange={(_, selected) => {
            const picking = showPicker;
            setShowPicker(null);
            if (!selected) return;
            if (picking === 'from') setDateFrom(selected);
            else setDateTo(selected);
          }}
        />
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={32} color={colors.red} />
            <Text style={styles.emptyTitle}>{loadError}</Text>
          </View>
        ) : filteredRsvps.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-square" size={32} color={colors.textSubtle} />
            <Text style={styles.emptyTitle}>
              {filter === 'alles' ? 'Geen RSVPs nie' : `Geen ${RSVP_STATUS_LABELS[filter].toLowerCase()} RSVPs nie`}
            </Text>
            <Text style={styles.emptySubtitle}>
              Gaan na Funksies om vir aankomende geleenthede te RSVP.
            </Text>
          </View>
        ) : (
          filteredRsvps.map(({ _id, status, event }) => {
            const cfg = {
              ...getRsvpStatusColors(status, isDark),
              label: RSVP_STATUS_LABELS[status],
              icon: RSVP_STATUS_ICONS[status],
            };
            const { day, month } = formatDate(event.date);
            const showQr = openQrId === _id;
            return (
              <View key={_id} style={styles.rsvpCard}>
                <View style={styles.rsvpCardTop}>
                  <View style={styles.rsvpDateBadge}>
                    <Text style={styles.rsvpDay}>{day}</Text>
                    <Text style={styles.rsvpMonth}>{month}</Text>
                  </View>
                  <View style={styles.rsvpInfo}>
                    <Text style={styles.rsvpTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.rsvpMeta} numberOfLines={1}> {event.location}</Text>
                  </View>
                  <View style={[styles.rsvpBadge, { backgroundColor: cfg.bg }]}>
                    <Feather name={cfg.icon} size={12} color={cfg.text} />
                  </View>
                </View>

                <View style={styles.rsvpDetails}>
                  <View style={styles.rsvpDetailRow}>
                    <Text style={styles.rsvpDetailLabel}>Status</Text>
                    <Text style={[styles.rsvpDetailValue, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>

                {showQr && (
                  <ViewShot
                    ref={(r) => { ticketRefs.current[_id] = r; }}
                    options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                  >
                    <View style={styles.ticketCard}>
                      <Text style={styles.ticketEventTitle}>{event.title}</Text>
                      <Text style={styles.ticketMeta}>{day} {month} · {event.location}</Text>
                      <View style={styles.qrBox}>
                        {qrLoadingId === _id ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : qrUriById[_id] ? (
                          <Image
                            source={{ uri: qrUriById[_id] }}
                            style={styles.qrImage}
                            resizeMode="contain"
                            accessibilityLabel="Jou QR-kode"
                          />
                        ) : null}
                      </View>
                      {attendeeName ? <Text style={styles.ticketAttendee}>{attendeeName}</Text> : null}
                    </View>
                  </ViewShot>
                )}

                <View style={styles.rsvpActions}>
                  <TouchableOpacity
                    style={styles.qrBtn}
                    onPress={() => toggleQr(_id)}
                    accessibilityLabel={showQr ? 'Versteek Qr-Kode' : 'Wys QR-kode'}
                  >
                    <Feather name="maximize" size={13} color={colors.primary} />
                    <Text style={styles.qrBtnText}>{showQr ? 'Versteek QR' : 'Wys QR'}</Text>
                  </TouchableOpacity>

                  {showQr && qrUriById[_id] && (
                    <TouchableOpacity
                      style={styles.qrBtn}
                      onPress={() => handleShareTicket(_id)}
                      accessibilityLabel="Stoor kaartjie"
                    >
                      <Feather name="download" size={13} color={colors.primary} />
                      <Text style={styles.qrBtnText}>Stoor Kaartjie</Text>
                    </TouchableOpacity>
                  )}

                  {status !== 'GEKANSELLEER' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelRsvp(_id, event.title)}
                      disabled={cancelingId === _id}
                      accessibilityLabel={`Kanselleer RSVP vir ${event.title}`}
                    >
                      {cancelingId === _id ? (
                        <ActivityIndicator size="small" color={colors.textSubtle} />
                      ) : (
                        <Text style={styles.cancelBtnText}>Kanselleer RSVP</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexWrap: 'wrap',
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 16, fontWeight: '700', color: colors.textSubtle },
    chipTextActive: { color: colors.surface },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },

    dateFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    dateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    dateBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
    dateSep: { fontSize: 13, color: colors.textSubtle },
    clearDatesBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 6,
    },

    scroll: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },

    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySubtitle: { fontSize: 16, color: colors.textSubtle, textAlign: 'center', lineHeight: 18 },

    // Student RSVP card
    rsvpCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    rsvpCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rsvpDateBadge: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.infoBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rsvpDay: { fontSize: 17, fontWeight: '900', color: colors.info, lineHeight: 20 },
    rsvpMonth: { fontSize: 16, fontWeight: '800', color: colors.info },
    rsvpInfo: { flex: 1 },
    rsvpTitle: { ...typography.body, color: colors.text, marginBottom: 2 },
    rsvpMeta: { ...typography.caption, color: colors.textSubtle },
    rsvpBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rsvpDetails: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 10,
      gap: 6,
    },
    rsvpDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    rsvpDetailLabel: { ...typography.caption, color: colors.textSubtle },
    rsvpDetailValue: { ...typography.body, color: colors.text },
    cancelBtn: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    cancelBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSubtle },

    rsvpActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    qrBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    qrBtnText: { fontSize: 16, fontWeight: '800', color: colors.primary },
    qrBox: {
      alignSelf: 'center',
      width: 200,
      height: 200,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    qrImage: { width: '100%', height: '100%' },

    ticketCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      alignItems: 'center',
      gap: 8,
    },
    ticketEventTitle: { fontSize: 16, fontWeight: '900', color: '#111111', textAlign: 'center' },
    ticketMeta: { fontSize: 13, fontWeight: '600', color: '#555555', textAlign: 'center' },
    ticketAttendee: { fontSize: 13, fontWeight: '700', color: '#111111', marginTop: 4 },
  });
}