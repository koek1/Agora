import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../theme/theme';
import type { ThemeColors } from '../theme/theme';
import { typography } from '../theme/typography';
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
} from '../lib/date-range';

const CELL_HEIGHT = 40;
const DAY_SIZE = 34;
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * 5;

// Die deurskynende tint agter die dae tussen die twee eindpunte. RN het geen
// kleur-funksies nie, so ons meng die hex self met 'n alfa-waarde.
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface DateRangePickerProps {
  /** Begin van die reeks as 'yyyy-mm-dd', of '' vir geen filter nie. */
  from: string;
  /** Einde van die reeks as 'yyyy-mm-dd'. Gelyk aan `from` vir 'n enkel dag. */
  to: string;
  onChange: (from: string, to: string) => void;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Die kalender vou oop binne die filter-blad, sodat die blad nie altyd
  // sy volle hoogte in beslag neem nie.
  const [expanded, setExpanded] = useState(false);
  const [wheelsOpen, setWheelsOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = computeTodayKey(today);

  const [viewYear, setViewYear] = useState(() => (from ? yearOf(from) : today.getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (from ? monthOf(from) : today.getMonth()));

  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  const { firstWeekday, daysInMonth, totalCells } = monthGrid(viewYear, viewMonth);
  const years = yearOptions(viewYear, today);

  // Rol dadelik na die gekose maand en jaar sodra die wiele oopmaak, sodat die
  // gebruiker nie eers hoef te soek waar hy is nie.
  useEffect(() => {
    if (!wheelsOpen) return;
    const centre = (index: number) => Math.max(0, index * WHEEL_ITEM_HEIGHT - WHEEL_HEIGHT / 2 + WHEEL_ITEM_HEIGHT / 2);
    monthScrollRef.current?.scrollTo({ y: centre(viewMonth), animated: false });
    yearScrollRef.current?.scrollTo({ y: centre(years.indexOf(viewYear)), animated: false });
  }, [wheelsOpen]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleDayPress(key: string) {
    const next = nextRange(from, to, key);
    onChange(next.from, next.to);
  }

  const singleDay = isSingleDay(from, to);
  const { from: rangeStart, to: rangeEnd } = drawnRange(from, to, null);
  const hasRange = Boolean(from);
  const label = formatRangeLabel(from, to, 'Enige datum');

  const softTint = withAlpha(colors.primary, 0.15);

  return (
    <View>
      {/* ── Opsomming-ry, tik om die kalender oop te vou ── */}
      <TouchableOpacity
        style={[styles.summary, hasRange && { borderColor: colors.primary, backgroundColor: softTint }]}
        onPress={() => setExpanded((e) => !e)}
        accessibilityLabel="Kies 'n datumreeks"
        accessibilityState={{ expanded }}
      >
        <Feather name="calendar" size={16} color={hasRange ? colors.primary : colors.textSubtle} />
        <Text style={[styles.summaryText, hasRange && { color: colors.primary, fontWeight: '600' }]}>
          {label}
        </Text>
        {hasRange ? (
          <TouchableOpacity
            onPress={() => onChange('', '')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Vee datumfilter uit"
          >
            <Feather name="x" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSubtle} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          {/* ── Maand-navigasie. Die opskrif self maak die wiele oop ── */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn} accessibilityLabel="Vorige maand">
              <Feather name="chevron-left" size={18} color={colors.textSubtle} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setWheelsOpen((w) => !w)}
              style={styles.navTitleBtn}
              accessibilityLabel="Kies maand en jaar"
              accessibilityState={{ expanded: wheelsOpen }}
            >
              <Text style={styles.navTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
              <Feather name={wheelsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSubtle} />
            </TouchableOpacity>

            <TouchableOpacity onPress={nextMonth} style={styles.navBtn} accessibilityLabel="Volgende maand">
              <Feather name="chevron-right" size={18} color={colors.textSubtle} />
            </TouchableOpacity>
          </View>

          {wheelsOpen ? (
            <>
              {/* ── Twee rolwiele: maand links, jaar regs ── */}
              <View style={styles.wheelRow}>
                <ScrollView
                  ref={monthScrollRef}
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {MONTHS.map((name, index) => {
                    const selected = index === viewMonth;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.wheelItem, selected && { backgroundColor: colors.primary }]}
                        onPress={() => setViewMonth(index)}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.wheelText, selected && { color: colors.primaryText, fontWeight: '600' }]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <ScrollView
                  ref={yearScrollRef}
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {years.map((year) => {
                    const selected = year === viewYear;
                    return (
                      <TouchableOpacity
                        key={year}
                        style={[styles.wheelItem, selected && { backgroundColor: colors.primary }]}
                        onPress={() => setViewYear(year)}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.wheelText, selected && { color: colors.primaryText, fontWeight: '600' }]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                onPress={() => setWheelsOpen(false)}
              >
                <Text style={[styles.doneBtnText, { color: colors.primaryText }]}>Klaar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.weekRow}>
                {DAYS.map((d) => (
                  <View key={d} style={styles.cell}>
                    <Text style={styles.weekLabel}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* ── Dae ── */}
              <View style={styles.grid}>
                {Array.from({ length: totalCells }).map((_, cellIdx) => {
                  const day = cellIdx - firstWeekday + 1;
                  if (day < 1 || day > daysInMonth) {
                    return <View key={cellIdx} style={styles.cell} />;
                  }

                  const key = dayKey(viewYear, viewMonth, day);
                  const isStart = key === rangeStart;
                  const isEnd = Boolean(rangeEnd) && key === rangeEnd;
                  // Die dae tussen die twee punte kry die ligter blou balk, die
                  // begin- en einddag self kry die donkerder blou blokkie.
                  const isBetween = Boolean(rangeStart && rangeEnd && key > rangeStart && key < rangeEnd);
                  const inRange = isStart || isEnd || isBetween;

                  const roundLeft = isStart || (inRange && day === 1);
                  const roundRight = isEnd || (inRange && day === daysInMonth);

                  return (
                    <View
                      key={cellIdx}
                      style={[
                        styles.cell,
                        inRange && { backgroundColor: softTint },
                        // Rond die balk se punte af sodat dit soos een streep lyk
                        roundLeft && { borderTopLeftRadius: CELL_HEIGHT / 2, borderBottomLeftRadius: CELL_HEIGHT / 2 },
                        roundRight && { borderTopRightRadius: CELL_HEIGHT / 2, borderBottomRightRadius: CELL_HEIGHT / 2 },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.day,
                          (isStart || isEnd) && { backgroundColor: colors.primary },
                          !inRange && key === todayKey && { borderWidth: 1, borderColor: colors.primary },
                        ]}
                        onPress={() => handleDayPress(key)}
                        accessibilityLabel={formatLong(key)}
                        accessibilityState={{ selected: inRange }}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            (isStart || isEnd) && { color: colors.primaryText, fontWeight: '700' },
                            !inRange && key === todayKey && { fontWeight: '700' },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* ── Voetstuk ── */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {!from
                    ? 'Kies ’n dag'
                    : singleDay
                      ? 'Tik ’n tweede dag vir ’n reeks, of dieselfde dag om af te haal'
                      : `${formatDay(from, false)} – ${formatDay(to, true)}`}
                </Text>
                {hasRange && (
                  <TouchableOpacity onPress={() => onChange('', '')} accessibilityLabel="Vee datumfilter uit">
                    <Text style={[styles.footerClear, { color: colors.primary }]}>Vee uit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryText: {
      ...typography.body,
      color: colors.text,
      flex: 1,
    },
    panel: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 8,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    navBtn: { padding: 6 },
    navTitleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    navTitle: {
      ...typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    weekRow: { flexDirection: 'row' },
    weekLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: `${100 / 7}%`,
      height: CELL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    day: {
      width: DAY_SIZE,
      height: DAY_SIZE,
      borderRadius: DAY_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayText: {
      ...typography.body,
      color: colors.text,
    },
    wheelRow: { flexDirection: 'row', gap: 8 },
    wheel: {
      flex: 1,
      height: WHEEL_HEIGHT,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    wheelItem: {
      height: WHEEL_ITEM_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 12,
      marginHorizontal: 4,
      borderRadius: 8,
    },
    wheelText: {
      ...typography.body,
      color: colors.text,
    },
    doneBtn: {
      marginTop: 8,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
    },
    doneBtnText: {
      ...typography.body,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: {
      ...typography.caption,
      color: colors.textSubtle,
      flex: 1,
    },
    footerClear: {
      ...typography.caption,
      fontWeight: '600',
    },
  });
}
