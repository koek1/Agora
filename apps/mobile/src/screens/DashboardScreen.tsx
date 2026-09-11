import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useAuthStore } from '../stores/auth.store';
import { useThemeColors } from '../theme/theme';
import { listEvents, type EventResponse } from '../api/events';
import { getMyRsvps, type RsvpWithEvent } from '../api/rsvp';
import { getPrediction, type PredictionResult } from '../api/analytics';
import { getEventStatus, formatFullDate, formatEventTime, formatEventDate } from '../lib/event-status';
import { takeEventsPrefetch, takeMyRsvpsPrefetch, takePredictionPrefetch } from '../lib/prefetch';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProfileModal } from '../components/ProfileModal';
import { typography } from '../theme/typography';

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [aiInfoOpen, setAiInfoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [myRsvps, setMyRsvps] = useState<RsvpWithEvent[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isStaff = user?.role === 'ADMIN' || user?.role === 'DOSENT';

  // Laai elke keer wat hierdie oortjie fokus kry (nie net met die eerste
  // koppeling nie) -- sonder dit sou 'n RSVP wat elders gekanselleer is, of 'n
  // nuwe funksie wat geskep is, nooit hier opgedateer wys totdat die hele app
  // herbegin word nie.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;

      // Herbruik die agtergrond-voorlaai wat tydens onboarding begin het as dit nog
      // vars is -- dan is daar hier glad geen nuwe netwerkversoek nodig nie.
      const prefetchedPrediction = takePredictionPrefetch();

      (async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const eventList = await (takeEventsPrefetch() ?? listEvents());
          if (!active) return;
          setEvents(eventList);

          if (!isStaff) {
            const rsvpList = await (takeMyRsvpsPrefetch() ?? getMyRsvps());
            if (active) setMyRsvps(rsvpList);
          }

          const upcoming = eventList.filter((e) => getEventStatus(e) !== 'past');
          if (isStaff && upcoming.length > 0) {
            try {
              const pred = await (prefetchedPrediction ?? getPrediction(upcoming[0].id));
              if (active) setPrediction(pred);
            } catch {
              if (active) setPrediction(null);
            }
          }
        } catch {
          if (active) setLoadError('Kon nie paneelbord-data laai nie.');
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => { active = false; };
    }, [user?.id, isStaff]),
  );

  if (!user) return null;

  const upcomingEvents = events.filter((e) => getEventStatus(e) !== 'past');
  const nextEvent = upcomingEvents[0] ?? null;
  const otherUpcoming = upcomingEvents.slice(1, 4);

  const activeRsvps = myRsvps.filter((r) => r.status !== 'GEKANSELLEER');
  const upcomingRsvpsCount = activeRsvps.filter((r) => getEventStatus(r.event) !== 'past').length;

  const totalConfirmedAttendees = events.reduce((sum, e) => sum + e.confirmedAttendees, 0);
  // "Bywoning" is werklike opdaag-syfers (QR geskandeer), nie RSVP-vulkoers nie --
  // en 'n geleentheid wat nog moet plaasvind het per definisie nog geen bywoning
  // om te meet nie, so ons tel net reeds-afgelope geleenthede.
  const pastEvents = events.filter((e) => getEventStatus(e) === 'past' && e.maxCapacity > 0);
  const attendanceRates = pastEvents.map((e) => e.checkedInCount / e.maxCapacity);
  const averageAttendancePct = attendanceRates.length
    ? Math.round((attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length) * 100)
    : 0;

  const roleLabel = {
    ADMIN:  'Administrateur',
    DOSENT: 'Dosent',
    STUDENT: 'Student',
    GAS:    'Gas',
    PHOTOGRAPHER: 'Fotograaf',
  }[user.role];

  const handleLogout = () => {
    Alert.alert(
      'Meld af',
      'Is jy seker jy wil afmeld?',
      [
        { text: 'Kanselleer', style: 'cancel' },
        { text: 'Meld af', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={`Goeie dag, ${user.name}`}
        subtitle={`${roleLabel}${user.studyCenter ? ` • ${user.studyCenter}` : ''}`}
        right={
          <>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => setProfileOpen(true)}
              accessibilityLabel="My profiel"
            >
              <Text style={styles.avatarBtnText}>
                {`${user.name.charAt(0)}${user.surname.charAt(0)}`.toUpperCase()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
              <Feather name="settings" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
              <Feather name="log-out" size={18} color={colors.red} />
            </TouchableOpacity>
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>

        {loading && (
          <View style={styles.card}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && loadError && (
          <View style={styles.card}>
            <Text style={styles.highlightMeta}>{loadError}</Text>
          </View>
        )}

        {!loading && !loadError && (
          <>
            {nextEvent ? (
              <TouchableOpacity
                style={styles.heroCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('EventDetail', { eventId: nextEvent.id })}
                accessibilityLabel={`Besigtig ${nextEvent.title}`}
              >
                <Text style={styles.heroLabel}>VOLGENDE FUNKSIE</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{nextEvent.title}</Text>
                <Text style={styles.heroMeta}>
                  {formatFullDate(nextEvent.date)} • {formatEventTime(nextEvent.date)} • {nextEvent.location}
                </Text>

                <View style={styles.heroProgressTrack}>
                  <View
                    style={[
                      styles.heroProgressFill,
                      { width: `${nextEvent.maxCapacity > 0 ? Math.min(100, (nextEvent.confirmedAttendees / nextEvent.maxCapacity) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.heroFoot}>
                  {nextEvent.confirmedAttendees} / {nextEvent.maxCapacity} RSVPs · {nextEvent.maxCapacity > 0 ? Math.round((nextEvent.confirmedAttendees / nextEvent.maxCapacity) * 100) : 0}% gevul
                </Text>

                <View style={styles.heroCta}>
                  <Text style={styles.heroCtaText}>Besigtig funksie</Text>
                  <Feather name="arrow-right" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.card}>
                <Text style={styles.highlightMeta}>Geen aankomende funksies nie.</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Oorsig</Text>
            <View style={styles.statsGrid}>
              {user.role === 'ADMIN' && (
                <StatCard styles={styles} label="Totale RSVPs" value={String(totalConfirmedAttendees)} />
              )}
              {(user.role === 'ADMIN' || user.role === 'DOSENT') && (
                <StatCard styles={styles} label="Aankomende funksies" value={String(upcomingEvents.length)} />
              )}
              {(user.role === 'ADMIN' || user.role === 'DOSENT') && (
                <StatCard styles={styles} label="Gem. bywoning" value={`${averageAttendancePct}%`} />
              )}
              {(user.role === 'STUDENT' || user.role === 'GAS') && (
                <StatCard styles={styles} label="Jou RSVPs" value={String(activeRsvps.length)} />
              )}
              {(user.role === 'STUDENT' || user.role === 'GAS') && (
                <StatCard styles={styles} label="Aankomend" value={String(upcomingRsvpsCount)} />
              )}
            </View>

            {isStaff && (
              <TouchableOpacity
                style={styles.aiStrip}
                onPress={() => setAiInfoOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Wys KI-voorspelling besonderhede"
              >
                <View style={styles.aiStripIcon}>
                  <Feather name="cpu" size={16} color={colors.primary} />
                </View>
                <View style={styles.aiStripText}>
                  <Text style={styles.aiStripTitle} numberOfLines={1}>
                    {prediction
                      ? `KI verwag ${Math.round(prediction.predictedFillRate * 100)}% vulkoers`
                      : 'Geen KI-voorspelling beskikbaar nie'}
                  </Text>
                  {prediction && (
                    <Text style={styles.aiStripSub} numberOfLines={1}>
                      {prediction.estimatedAttendees} bywoners verwag · R{Math.round(prediction.estimatedBudgetZAR).toLocaleString('af-ZA')}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSubtle} />
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Aankomende funksies</Text>
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Events')}
                >
                  <Text style={styles.linkText}>Sien almal</Text>
                  <Feather name="chevron-right" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {otherUpcoming.length > 0 ? (
                otherUpcoming.map((e) => {
                  const { day, month } = formatEventDate(e.date);
                  return (
                    <UpcomingRow
                      key={e.id}
                      styles={styles}
                      title={e.title}
                      date={`${day} ${month}`}
                      time={formatEventTime(e.date)}
                      rsvps={String(e.confirmedAttendees)}
                      capacity={String(e.maxCapacity)}
                    />
                  );
                })
              ) : (
                <Text style={styles.highlightMeta}>Geen verdere aankomende funksies nie.</Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.versionText}>Beta</Text>

      </ScrollView>

      <Modal
        visible={aiInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAiInfoOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAiInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => { /* stop propagation */ }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>KI-voorspelling: volgende funksie</Text>
              <TouchableOpacity style={styles.iconBtnSm} onPress={() => setAiInfoOpen(false)}>
                <Feather name="x" size={16} color={colors.textSubtle} />
              </TouchableOpacity>
            </View>

            {prediction ? (
              <>
                <View style={styles.kpiGrid}>
                  <Kpi styles={styles} label="Voorspelde vulkoers" value={`${Math.round(prediction.predictedFillRate * 100)}%`} />
                  <Kpi styles={styles} label="Verwagte RSVPs" value={String(prediction.estimatedRsvps)} />
                  <Kpi styles={styles} label="Verwagte bywoners" value={String(prediction.estimatedAttendees)} />
                  <Kpi styles={styles} label="Beraamde begroting" value={`R${Math.round(prediction.estimatedBudgetZAR).toLocaleString('af-ZA')}`} />
                </View>
                <View style={styles.modelPill}>
                  <View style={styles.dot} />
                  <Text style={styles.modelText}>Model aktief</Text>
                </View>
              </>
            ) : (
              <Text style={styles.highlightMeta}>
                {nextEvent ? 'Voorspelling nie tans beskikbaar nie.' : 'Geen aankomende funksie om te voorspel nie.'}
              </Text>
            )}

            <InfoRow styles={styles} title="Voorspelde vulkoers" body="Persentasie van kapasiteit wat die model verwag om gevul te word." />
            <InfoRow styles={styles} title="Verwagte RSVPs" body="Aantal RSVPs wat die model verwag teen die funksie se datum." />
            <InfoRow styles={styles} title="Verwagte bywoners" body="Beraamde aantal mense wat werklik gaan opdaag (na no-shows)." />
            <InfoRow styles={styles} title="Beraamde begroting" body="Model se beraming van benodigde begroting gebaseer op verwagte bywoning." />

            <Text style={styles.modalFoot}>Hierdie waardes kom van die regte voorspellingsmodel vir die eersvolgende funksie.</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──
type DashboardStyles = ReturnType<typeof makeStyles>;

function StatCard({
  styles,
  label,
  value,
  delta,
}: {
  styles: DashboardStyles;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {delta ? <Text style={styles.statDelta}>{delta}</Text> : <View style={{ height: 14 }} />}
    </View>
  );
}

function Kpi({ styles, label, value }: { styles: DashboardStyles; label: string; value: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValueLarge}>{value}</Text>
    </View>
  );
}

function InfoRow({ styles, title, body }: { styles: DashboardStyles; title: string; body: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function UpcomingRow({
  styles,
  title,
  date,
  time,
  rsvps,
  capacity,
}: {
  styles: DashboardStyles;
  title: string;
  date: string;
  time: string;
  rsvps: string;
  capacity: string;
}) {
  return (
    <View style={styles.upcomingRow}>
      <View style={styles.upcomingLeft}>
        <Text style={styles.upcomingTitle}>{title}</Text>
        <Text style={styles.upcomingMeta}>{date} • {time}</Text>
      </View>
      <View style={styles.upcomingRight}>
        <Text style={styles.upcomingNum}>{rsvps}</Text>
        <Text style={styles.upcomingSub}>RSVP</Text>
      </View>
      <View style={styles.upcomingRight}>
        <Text style={styles.upcomingNumMuted}>{capacity}</Text>
        <Text style={styles.upcomingSub}>Kapasiteit</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 16, paddingBottom: 24 },

    avatarBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarBtnText: { color: colors.primaryText, fontSize: 13, fontWeight: '900' },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sectionTitle: {
      ...typography.caption,
      color: colors.textSubtle,
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 6,
    },

    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: 20,
      marginBottom: 18,
    },
    heroLabel: { ...typography.micro, color: colors.primaryText, opacity: 0.75 },
    heroTitle: { ...typography.display, color: colors.primaryText, marginTop: 6 },
    heroMeta: { ...typography.bodyRegular, color: colors.primaryText, opacity: 0.85, marginTop: 6 },
    heroProgressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
      marginTop: 16,
      overflow: 'hidden',
    },
    heroProgressFill: { height: 8, borderRadius: 999, backgroundColor: colors.primaryText },
    heroFoot: { ...typography.caption, color: colors.primaryText, opacity: 0.85, marginTop: 8 },
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primaryText,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 16,
    },
    heroCtaText: { ...typography.body, color: colors.primary, fontWeight: '900' },

    aiStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
    },
    aiStripIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiStripText: { flex: 1 },
    aiStripTitle: { ...typography.body, color: colors.text },
    aiStripSub: { ...typography.caption, color: colors.textSubtle, marginTop: 2 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    cardTitle: { ...typography.subtitle, color: colors.text },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    linkText: { color: colors.primary, fontWeight: '800', fontSize: 16 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    statCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
    },
    statLabel: { ...typography.caption, color: colors.textSubtle },
    statValue: { ...typography.title, color: colors.text, marginTop: 4 },
    statDelta: { ...typography.caption, color: colors.textSubtle, marginTop: 4 },

    iconBtnSm: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    highlightMeta: { ...typography.bodyRegular, color: colors.textSubtle, marginTop: 4 },

    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
    kpiBox: {
      width: '48%',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    kpiLabel: { ...typography.caption, color: colors.textSubtle },
    kpiValueLarge: { ...typography.title, color: colors.text, marginTop: 6 },
    modelPill: {
      marginTop: 12,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.success },
    modelText: { ...typography.caption, color: colors.text },

    upcomingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    upcomingLeft: { flex: 1 },
    upcomingTitle: { ...typography.body, color: colors.text },
    upcomingMeta: { ...typography.caption, color: colors.textSubtle, marginTop: 4 },
    upcomingRight: { width: 62, alignItems: 'flex-end' },
    upcomingNum: { ...typography.subtitle, color: colors.primary },
    upcomingNumMuted: { ...typography.subtitle, color: colors.textSubtle },
    upcomingSub: { ...typography.micro, color: colors.textSubtle, marginTop: 2 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    infoRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    infoTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    infoBody: { color: colors.textSubtle, fontSize: 16, marginTop: 6, lineHeight: 18, fontWeight: '600' },
    modalFoot: { color: colors.textSubtle, fontSize: 16, marginTop: 12, fontWeight: '600' },

    versionText: {
      ...typography.micro,
      textAlign: 'center',
      color: colors.textSubtle,
      marginTop: 16,
      marginBottom: 8,
    },
  });
}