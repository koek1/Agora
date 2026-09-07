import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../stores/auth.store';
import { useThemeColors, useIsDark } from '../theme/theme';
import {
  getEventStatus,
  getStatusPillColors,
  STATUS_LABELS,
  TYPE_LABELS,
  formatFullDate,
  formatEventTime,
} from '../lib/event-status';
import { canViewBudget, canManageCheckIns } from '../lib/rbac';
import { safeGoBack } from '../lib/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getEvent, createEvent, type EventResponse } from '../api/events';
import { AddressAutocompleteInput } from '../components/AddressAutoCompleteInput';
import type { PlaceDetails } from '../api/places';
import { createRsvp } from '../api/rsvp';
import { getDraftPrediction, getPrediction } from '../api/analytics';
import type { PredictionResult } from '../api/analytics';
import { ScreenHeader } from '../components/ScreenHeader';
import { PaymentModal } from '../components/PaymentModal';
import { typography } from '../theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;
type Route = RouteProp<RootStackParamList, 'EventDetail'>;

export function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const user = useAuthStore((s) => s.user);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDark = useIsDark();

  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);

  const isCreating = route.params.eventId === 'new';

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(true);
  const [predictionUnavailable, setPredictionUnavailable] = useState(false);

  useEffect(() => {
    if (isCreating) return;
    let active = true;
    (async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const data = await getEvent(route.params.eventId);
        if (active) setEvent(data);
      } catch (err: unknown) {
        const axiosErr = err as { message?: string; response?: { status?: number; data?: unknown } };
        console.error(
          `[EventDetail] Kon nie geleentheid ${route.params.eventId} laai nie:`,
          axiosErr?.response?.status,
          axiosErr?.response?.data ?? axiosErr?.message,
        );
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isCreating, route.params.eventId]);

  useEffect(() => {
    // Die model voorspel net vooruit uit kapasiteit/datum -- dit weet niks van
    // wat werklik gebeur het nie, so vir 'n afgelope geleentheid herhaal dit net
    // dieselfde raaiskoot as voor die tyd, wat nooit met die regte confirmedAttendees
    // ooreenstem nie. Ons moet dit dus nie eers vra vir geleenthede wat verby is nie.
    if (isCreating || !event || getEventStatus(event) === 'past') {
      setPredictionLoading(false);
      return;
    }
    let cancelled = false;
    setPredictionLoading(true);
    setPredictionUnavailable(false);
    getPrediction(event.id)
      .then((r) => { if (!cancelled) setPrediction(r); })
      .catch(() => { if (!cancelled) setPredictionUnavailable(true); })
      .finally(() => { if (!cancelled) setPredictionLoading(false); });
    return () => { cancelled = true; };
  }, [isCreating, event]);

  if (isCreating) {
    return (
      <CreateEventForm
        navigation={navigation}
        colors={colors}
        styles={styles}
      />
    );
  }

  const role = user?.role ?? 'STUDENT';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorWrap}>
          <Feather name="alert-circle" size={32} color={colors.textSubtle} />
          <Text style={styles.errorText}>Funksie nie gevind nie</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation)}>
            <Text style={styles.backBtnText}>Terug</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = getEventStatus(event);
  const fillPct = event.maxCapacity > 0 ? Math.min(Math.round((event.confirmedAttendees / event.maxCapacity) * 100), 100) : 0;
  const predictedPct = prediction ? Math.round(prediction.predictedFillRate * 100) : 0;
  const pillColor = getStatusPillColors(status, isDark);

  function handleManageRsvps() {
    navigation.navigate('RsvpManagement', { eventId: event!.id });
  }

  function handleQrScanner() {
    navigation.navigate('QrScanner', { eventId: event!.id });
  }

  async function handleRsvp() {
    setRsvpSubmitting(true);
    try {
      await createRsvp(event!.id);
      Alert.alert(
        'Ingeskryf!',
        'Jy is vir hierdie funksie ingeskryf. Sien jou QR-kode onder die RSVP-oortjie.',
        [{ text: 'OK' }],
      );
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      const status = axiosErr?.response?.status;
      const raw = axiosErr?.response?.data?.message;
      const backendMsg = Array.isArray(raw) ? raw.join(', ') : raw ?? '';

      const msg =
        status === 409
          ? backendMsg.toLowerCase().includes('vol')
            ? 'Hierdie geleentheid is ongelukkig vol bespreek'
            : 'Jy het reeds vir hierdie geleentheid ingeskryf'
          : backendMsg || 'Kon nie inskryf nie. Probeer asseblief weer.';

      Alert.alert('RSVP', msg, [{ text: 'OK' }]);
    } finally {
      setRsvpSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Back + header ── */}
      <ScreenHeader
        title="Funksie Detail"
        onBack={() => safeGoBack(navigation)}
        right={
          <View style={[styles.statusPill, { backgroundColor: pillColor.bg }]}>
            <Text style={[styles.statusPillText, { color: pillColor.text }]}>
              {STATUS_LABELS[status]}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventSubtitle}>
            {formatFullDate(event.date)}{event.endDate ? ` – ${formatEventTime(event.endDate)}` : ''} · {event.location}
          </Text>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{event.checkedInCount}</Text>
            <Text style={styles.statLabel}>Bygewoon</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textSubtle }]}>
              {prediction ? prediction.estimatedAttendees : '—'}
            </Text>
            <Text style={styles.statLabel}>Verwag</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{event.maxCapacity}</Text>
            <Text style={styles.statLabel}>Kapasiteit</Text>
          </View>
        </View>

        {/* ── AI prediction card ──
            Verby geleenthede het reeds 'n regte uitkoms (sien "Bygewoon" hierbo) --
            die model voorspel net vooruit en het geen benul van wat werklik gebeur
             het nie, so ons wys dit eenvoudig nie vir afgelope geleenthede nie. */}
        {status !== 'past' && (
          <View style={styles.aiCard}>
            {predictionLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : predictionUnavailable || !prediction ? (
              <Text style={styles.aiSubtitle}>KI-voorspelling nie tans beskikbaar vir hierdie funksie nie.</Text>
            ) : (
              <>
                <View style={styles.aiTop}>
                  <View>
                    <View style={styles.aiNumRow}>
                      <Text style={styles.aiNum}>{prediction.estimatedAttendees}</Text>
                      <Text style={styles.aiLabel}> gaste verwag</Text>
                    </View>
                    <Text style={styles.aiSubtitle}>
                      Vulkoers: {predictedPct}% · No-show: {Math.round(prediction.predictedNoShowRate * 100)}%
                    </Text>
                  </View>
                  <View style={styles.aiBadge}>
                    <Feather name="cpu" size={12} color={colors.primary} />
                    <Text style={styles.aiBadgeText}>KI</Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${predictedPct}%` }]} />
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Details table ── */}
        <View style={styles.detailsCard}>
          <DetailRow label="Datum" value={formatFullDate(event.date)} colors={colors} />
          <DetailRow
            label="Tyd"
            value={`${formatEventTime(event.date)}${event.endDate ? ` – ${formatEventTime(event.endDate)}` : ''}`}
            colors={colors}
          />
          <DetailRow label="Lokaal" value={event.location} colors={colors} />
          {event.address ? <DetailRow label="Adres" value={event.address} colors={colors} /> : null}
          <DetailRow label="Tipe" value={TYPE_LABELS[event.type]} colors={colors} />
          <DetailRow label="Kapasiteit" value={`${event.confirmedAttendees} / ${event.maxCapacity} (${fillPct}%)`} colors={colors} />
          {event.sellsTickets && (
            <DetailRow
              label="Kaartjieprys"
              value={`R${event.ticketPrice ?? 0}${event.ticketsAvailable !== null ? ` · ${event.ticketsAvailable} oor` : ''}`}
              colors={colors}
            />
          )}
          {canViewBudget(role) && (
            <DetailRow
              label="Begroting"
              value={`R ${event.budget.toLocaleString('af-ZA')}`}
              colors={colors}
              isLast
            />
          )}
          {!canViewBudget(role) && (
            <DetailRow label="Begroting" value="—" colors={colors} isLast />
          )}
        </View>

        {/* ── Description ── */}
        {event.description ? (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>Beskrywing</Text>
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        ) : null}

        {/* ── Action buttons ── */}
        {canManageCheckIns(role) && (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleManageRsvps}
              accessibilityLabel="Bestuur RSVPs"
            >
              <Feather name="users" size={16} color={colors.surface} />
              <Text style={styles.primaryBtnText}>Bestuur RSVPs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleQrScanner}
              accessibilityLabel="QR Skandeerder"
            >
              <Feather name="maximize" size={16} color={colors.text} />
              <Text style={styles.secondaryBtnText}>QR Skandeerder</Text>
            </TouchableOpacity>
          </>
        )}

        {(status === 'upcoming' || status === 'ongoing') && (
          event.sellsTickets ? (
            <PaymentModal event={event} />
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, rsvpSubmitting && styles.btnDisabled]}
              onPress={handleRsvp}
              disabled={rsvpSubmitting}
              accessibilityLabel="RSVP vir hierdie funksie"
            >
              {rsvpSubmitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color={colors.surface} />
                  <Text style={styles.primaryBtnText}>RSVP vir hierdie funksie</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function CreateEventForm({
  navigation,
  colors,
  styles,
}: {
  navigation: Nav;
  colors: ReturnType<typeof useThemeColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [location, setLocation] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [budget, setBudget] = useState('');
  const [sellsTickets, setSellsTickets] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketsAvailable, setTicketsAvailable] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionUnavailable, setPredictionUnavailable] = useState(false);
  const [predictionErrorDetail, setPredictionErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    const cap = parseInt(maxCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setPrediction(null);
      setPredictionUnavailable(false);
      setPredictionErrorDetail(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setPredictionLoading(true);
      setPredictionUnavailable(false);
      setPredictionErrorDetail(null);

      getDraftPrediction({ date: date.toISOString(), maxCapacity: cap })
        .then((result) => {
          if (!cancelled) setPrediction(result);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setPrediction(null);
          setPredictionUnavailable(true);

          const axiosErr = err as {
            message?: string;
            code?: string;
            config?: { baseURL?: string; url?: string };
            response?: { status?: number; data?: { message?: string | string[] } };
          };
          const backendMsg = axiosErr?.response?.data?.message;
          const detail = backendMsg
            ? (Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg)
            : axiosErr?.message ?? 'Onbekende fout';
          const status = axiosErr?.response?.status;
          const requestedUrl = `${axiosErr?.config?.baseURL ?? ''}${axiosErr?.config?.url ?? ''}`;
          setPredictionErrorDetail(
            `${status ? `[${status}] ` : ''}${detail}\n${requestedUrl}`,
          );
        })
        .finally(() => {
          if (!cancelled) setPredictionLoading(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [date, maxCapacity]);

  function handleApplyBudget() {
    if (prediction) setBudget(String(prediction.estimatedBudgetZAR));
  }

  async function handleSubmit() {
    if (!title.trim() || !location.trim() || !maxCapacity.trim()) {
      setError('Vul asseblief alle velde in.');
      return;
    }

    if (!placeDetails) {
      setError('Kies \'n geldige adres uit die soeklys.');
      return;
    }

    if (!startHour.trim() || !startMinute.trim()) {
      setError('Vul asseblief die begintyd in.');
      return;
    }

    const sh = parseInt(startHour, 10);
    const sm = parseInt(startMinute, 10);
    if (isNaN(sh) || sh < 0 || sh > 23 || isNaN(sm) || sm < 0 || sm > 59) {
      setError('Begintyd is ongeldig.');
      return;
    }

    const cap = parseInt(maxCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setError('Kapasiteit moet \'n positiewe getal wees.');
      return;
    }

    let budgetNum: number | undefined;
    if (budget.trim()) {
      budgetNum = Number(budget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        setError('Begroting moet \'n geldige positiewe getal wees.');
        return;
      }
    }

    let ticketPriceNum: number | undefined;
    let ticketsAvailableNum: number | undefined;
    if (sellsTickets) {
      ticketPriceNum = Number(ticketPrice);
      if (!ticketPrice.trim() || isNaN(ticketPriceNum) || ticketPriceNum <= 0) {
        setError('Gee asseblief \'n geldige kaartjieprys.');
        return;
      }
      ticketsAvailableNum = Number(ticketsAvailable);
      if (!ticketsAvailable.trim() || isNaN(ticketsAvailableNum) || ticketsAvailableNum <= 0) {
        setError('Gee asseblief \'n geldige aantal kaartjies.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const startDate = new Date(date);
      startDate.setHours(parseInt(startHour, 10), parseInt(startMinute, 10), 0, 0);

      let endDate: string | undefined;
      if (endHour.trim() && endMinute.trim()) {
        const eh = parseInt(endHour, 10);
        const em = parseInt(endMinute, 10);
        if (!isNaN(eh) && !isNaN(em)) {
          const d = new Date(date);
          d.setHours(eh, em, 0, 0);
          endDate = d.toISOString();
        }
      }

      await createEvent({
        title: title.trim(),
        description: description.trim(),
        date: startDate.toISOString(),
        endDate,
        location: location.trim(),
        address: placeDetails.address,
        maxCapacity: cap,
        budget: budgetNum,
        sellsTickets,
        ticketPrice: sellsTickets ? ticketPriceNum : undefined,
        ticketsAvailable: sellsTickets ? ticketsAvailableNum : undefined,
      });
      safeGoBack(navigation);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message;
      const msg =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
          ? raw.join(', ')
          : 'Kon nie funksie skep nie. Probeer weer.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Nuwe Funksie"
        onBack={() => safeGoBack(navigation)}
        backDisabled={isSubmitting}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.red} />
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Titel *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="bv. Gradeplegtigheid 2026"
            placeholderTextColor={colors.textSubtle}
            value={title}
            onChangeText={setTitle}
            editable={!isSubmitting}
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Beskrywing</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Opsionele beskrywing..."
            placeholderTextColor={colors.textSubtle}
            value={description}
            onChangeText={setDescription}
            editable={!isSubmitting}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Datum *</Text>
          <TouchableOpacity
            style={styles.textInput}
            onPress={() => setShowDatePicker(true)}
            disabled={isSubmitting}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
              {date.toLocaleDateString('af-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="calendar"
              minimumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(false);
                if (selected) setDate(selected);
              }}
            />
          )}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Begintyd *</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.textInput, styles.timeInput]}
              placeholder="HH"
              placeholderTextColor={colors.textSubtle}
              value={startHour}
              onChangeText={(v) => setStartHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              style={[styles.textInput, styles.timeInput]}
              placeholder="MM"
              placeholderTextColor={colors.textSubtle}
              value={startMinute}
              onChangeText={(v) => setStartMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Eindtyd (opsioneel)</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.textInput, styles.timeInput]}
              placeholder="HH"
              placeholderTextColor={colors.textSubtle}
              value={endHour}
              onChangeText={(v) => setEndHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              style={[styles.textInput, styles.timeInput]}
              placeholder="MM"
              placeholderTextColor={colors.textSubtle}
              value={endMinute}
              onChangeText={(v) => setEndMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Ligging *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="bv. Hoofsaal, Kampus A"
            placeholderTextColor={colors.textSubtle}
            value={location}
            onChangeText={setLocation}
            editable={!isSubmitting}
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Adres *</Text>
          <AddressAutocompleteInput
            initialAddress={placeDetails?.address}
            onSelect={setPlaceDetails}
            editable={!isSubmitting}
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Kapasiteit *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="bv. 200"
            placeholderTextColor={colors.textSubtle}
            value={maxCapacity}
            onChangeText={setMaxCapacity}
            editable={!isSubmitting}
            keyboardType="number-pad"
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Begroting (R, opsioneel)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="bv. 15000"
            placeholderTextColor={colors.textSubtle}
            value={budget}
            onChangeText={setBudget}
            editable={!isSubmitting}
            keyboardType="number-pad"
            returnKeyType="done"
          />

          <View style={styles.ticketToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Verkoop kaartjies</Text>
              <Text style={styles.fieldHint}>Gaste moet betaal om in te skryf</Text>
            </View>
            <Switch
              value={sellsTickets}
              onValueChange={setSellsTickets}
              disabled={isSubmitting}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {sellsTickets && (
            <View style={styles.ticketRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Kaartjieprys (R) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="bv. 150"
                  placeholderTextColor={colors.textSubtle}
                  value={ticketPrice}
                  onChangeText={setTicketPrice}
                  editable={!isSubmitting}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Aantal kaartjies *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="bv. 100"
                  placeholderTextColor={colors.textSubtle}
                  value={ticketsAvailable}
                  onChangeText={setTicketsAvailable}
                  editable={!isSubmitting}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}
        </View>

        {(predictionLoading || predictionUnavailable || prediction) && (
          <View style={styles.predictionCard}>
            <View style={styles.predictionTop}>
              <Feather name="cpu" size={14} color={colors.primary} />
              <Text style={styles.predictionTitle}>KI-Voorspelling</Text>
            </View>

            {predictionLoading && (
              <View style={styles.predictionLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.predictionLoadingText}>Besig om te voorspel...</Text>
              </View>
            )}

            {!predictionLoading && predictionUnavailable && (
              <>
                <Text style={styles.predictionUnavailableText}>
                  Voorspellingsdiens is tans nie beskikbaar nie.
                </Text>
                {predictionErrorDetail && (
                  <Text style={styles.predictionErrorDetailText}>
                    {predictionErrorDetail}
                  </Text>
                )}
              </>
            )}

            {!predictionLoading && prediction && (
              <>
                <View style={styles.predictionStatsRow}>
                  <PredictionStat
                    label="Verwag"
                    value={`${prediction.estimatedAttendees}`}
                    colors={colors}
                  />
                  <PredictionStat
                    label="Vulkoers"
                    value={`${Math.round(prediction.predictedFillRate * 100)}%`}
                    colors={colors}
                  />
                  <PredictionStat
                    label="Begroting"
                    value={`R ${prediction.estimatedBudgetZAR.toLocaleString('af-ZA')}`}
                    colors={colors}
                  />
                </View>

                <TouchableOpacity
                  style={styles.applyBudgetBtn}
                  onPress={handleApplyBudget}
                  disabled={isSubmitting}
                >
                  <Text style={styles.applyBudgetText}>Gebruik Voorgestelde Begroting</Text>
                </TouchableOpacity>

                <Text style={styles.reasoningHeading}>Waarom hierdie voorspelling?</Text>
                {prediction.reasoning.map((reason, i) => (
                  <View key={i} style={styles.reasoningRow}>
                    <Text style={styles.reasoningBullet}>•</Text>
                    <Text style={styles.reasoningText}>{reason}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color={colors.surface} />
            : <Feather name="check" size={16} color={colors.surface} />
          }
          <Text style={styles.primaryBtnText}>
            {isSubmitting ? 'Besig om te skep...' : 'Skep Funksie'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { marginTop: 10 }]}
          onPress={() => safeGoBack(navigation)}
          disabled={isSubmitting}
        >
          <Text style={styles.secondaryBtnText}>Kanselleer</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PredictionStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ ...typography.subtitle, color: colors.text }}>{value}</Text>
      <Text style={{ ...typography.caption, color: colors.textSubtle, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  isLast,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text style={{ ...typography.caption, color: colors.textSubtle }}>{label}</Text>
      <Text style={{ ...typography.body, color: colors.text, maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusPillText: { fontSize: 16, fontWeight: '800' },

    scroll: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },

    titleBlock: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    eventTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 6 },
    eventSubtitle: { ...typography.bodyRegular, color: colors.textSubtle, lineHeight: 18 },

    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { ...typography.heroStat, color: colors.primary },
    statLabel: { ...typography.caption, color: colors.textSubtle, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

    aiCard: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.surface,
    },
    aiTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    aiNumRow: { flexDirection: 'row', alignItems: 'baseline' },
    aiNum: { fontSize: 36, fontWeight: '900', color: colors.primary },
    aiLabel: { ...typography.body, color: colors.text },
    aiSubtitle: { ...typography.caption, color: colors.textSubtle, marginTop: 2 },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    aiBadgeText: { ...typography.micro, color: colors.primary },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },

    detailsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
    },

    descCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    descLabel: { ...typography.caption, color: colors.textSubtle, marginBottom: 8, letterSpacing: 0.5 },
    descText: { ...typography.bodyRegular, color: colors.text, lineHeight: 20 },

    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 52,
    },
    primaryBtnText: { fontSize: 16, fontWeight: '900', color: colors.surface },

    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      height: 52,
    },
    secondaryBtnText: { fontSize: 16, fontWeight: '900', color: colors.text },

    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32,
    },
    errorText: { fontSize: 16, fontWeight: '700', color: colors.textSubtle },
    backBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    backBtnText: { fontSize: 16, fontWeight: '800', color: colors.surface },

    btnDisabled: { opacity: 0.7 },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: 12,
      padding: 12,
    },
    errorBoxText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.red },

    formCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textSubtle,
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    fieldHint: { fontSize: 16, color: colors.textSubtle },
    ticketToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      gap: 10,
    },
    ticketRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
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
    textArea: {
      height: 100,
      paddingTop: 12,
    },

    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeInput: {
      flex: 1,
      textAlign: 'center',
    },
    timeColon: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
    },

    predictionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    predictionTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    predictionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
    predictionLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    predictionLoadingText: { fontSize: 16, fontWeight: '600', color: colors.textSubtle },
    predictionUnavailableText: { fontSize: 16, fontWeight: '600', color: colors.textSubtle },
    predictionErrorDetailText: { fontSize: 16, fontWeight: '500', color: colors.red, marginTop: 4 },
    predictionStatsRow: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      marginBottom: 12,
    },
    applyBudgetBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 14,
    },
    applyBudgetText: { fontSize: 16, fontWeight: '800', color: colors.surface },
    reasoningHeading: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textSubtle,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    reasoningRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 4,
    },
    reasoningBullet: { fontSize: 16, color: colors.primary, fontWeight: '900' },
    reasoningText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '600', lineHeight: 17 },
  });
}
