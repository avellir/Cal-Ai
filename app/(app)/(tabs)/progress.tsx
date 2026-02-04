import * as Haptics from 'expo-haptics';
import { Apple, Pencil, Scale, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-wagmi-charts';

import { AppBackground } from '@/components/ui/AppBackground';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DesignColors } from '@/constants/theme';
import { useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E6E6EB',
  text: '#111111',
  secondary: '#8E8E93',
  pillBg: '#F1F2F4',
  pillText: '#2C2C2E',
  line: DesignColors.success,
  ringTrack: '#E6E7EC',
  success: '#1F7A3D',
  successBg: '#E8F7ED',
  tooltipBg: '#1E1E1E',
  tooltipText: '#FFFFFF',
};

const RING_COLORS = {
  weight: ['#2C2C2E', '#2C2C2E'],
  days: ['#4F6BFF', '#6C8BFF'],
};

type RangeKey = '90d' | '6m' | '1y' | 'all';

const TIMEFRAMES: { key: RangeKey; label: string; days?: number }[] = [
  { key: '90d', label: '90 Days', days: 90 },
  { key: '6m', label: '6 Months', days: 180 },
  { key: '1y', label: '1 Year', days: 365 },
  { key: 'all', label: 'All time' },
];

const CHART_HEIGHT = 240;
const CHART_Y_GUTTER = 8;

const ALL_TIME_START = new Date(2010, 0, 1);

type DayWeight = {
  date: Date;
  key: string;
  weight: number | null;
};

type StatCardProps = {
  label: string;
  value: string;
  ringValue: number | null;
  ringColors: string[];
  Icon: LucideIcon;
};

export default function ProgressScreen() {
  const session = useSessionStore((state) => state.session);
  const userId = session?.user?.id ?? null;

  const meals = useMealLogStore((state) => state.meals);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);

  const { goals, fetchGoals } = useUserGoalsStore();
  const { latest, history, fetchRange, isLoading: weightLoading, error: weightError } = useUserWeightLogStore();

  const [rangeKey, setRangeKey] = useState<RangeKey>('90d');
  const [chartWidth, setChartWidth] = useState(0);

  const range = TIMEFRAMES.find((item) => item.key === rangeKey) ?? TIMEFRAMES[0];
  const { startDate, endDate } = useMemo(() => getDateRange(range.days), [range.days]);

  useEffect(() => {
    if (!userId) return;

    fetchMeals(userId).catch((error) => {
      console.error('Failed to load meals', error);
    });

    fetchGoals(userId).catch((error) => {
      console.error('Failed to load goals', error);
    });
  }, [fetchMeals, fetchGoals, userId]);

  useEffect(() => {
    if (!userId) return;

    fetchRange(userId, startDate, endDate).catch((error) => {
      console.error('Failed to load weight history', error);
    });
  }, [userId, fetchRange, startDate, endDate]);

  const currentWeight = latest?.weightKg ?? goals?.weightKg ?? null;
  const goalWeight = goals?.targetWeightKg ?? null;

  const daySeries = useMemo(() => buildDaySeries(startDate, endDate, history), [startDate, endDate, history]);
  const emaSeries = useMemo(() => calculateEmaSeries(daySeries, 0.2), [daySeries]);

  const hasWeightData = daySeries.some((day) => typeof day.weight === 'number');

  const firstWeightTimestamp = useMemo(() => {
    const firstEntry = daySeries.find((day) => typeof day.weight === 'number');
    return firstEntry?.date.getTime() ?? null;
  }, [daySeries]);

  const lastWeightTimestamp = useMemo(() => {
    for (let i = daySeries.length - 1; i >= 0; i -= 1) {
      const value = daySeries[i]?.weight;
      if (typeof value === 'number') return daySeries[i].date.getTime();
    }
    return null;
  }, [daySeries]);

  const chartDomain = useMemo(() => {
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    if (!firstWeightTimestamp || !lastWeightTimestamp) {
      return { start: startTs, end: endTs };
    }
    const dataSpan = lastWeightTimestamp - firstWeightTimestamp;
    const minPad = 24 * 60 * 60 * 1000;
    const pad = Math.max(minPad, dataSpan * 0.08);
    let domainStart = firstWeightTimestamp - pad;
    let domainEnd = lastWeightTimestamp + pad;
    if (domainEnd <= domainStart) {
      domainEnd = domainStart + minPad;
    }
    return { start: domainStart, end: domainEnd };
  }, [startDate, endDate, firstWeightTimestamp, lastWeightTimestamp]);

  const emaChartData = useMemo(() => {
    return daySeries
      .map((day, index) => ({
        timestamp: day.date.getTime(),
        value: emaSeries[index],
      }))
      .filter(
        (point): point is { timestamp: number; value: number } =>
          typeof point.value === 'number' &&
          point.timestamp >= chartDomain.start &&
          point.timestamp <= chartDomain.end
      );
  }, [daySeries, emaSeries, chartDomain]);

  const yRange = useMemo(() => {
    const values: number[] = [];
    daySeries.forEach((day) => {
      if (typeof day.weight === 'number') values.push(day.weight);
    });
    emaSeries.forEach((value) => {
      if (typeof value === 'number') values.push(value);
    });

    if (values.length === 0) {
      return { min: 0, max: 1 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return { min: min - 1, max: max + 1 };
    }
    const padding = (max - min) * 0.08;
    return { min: min - padding, max: max + padding };
  }, [daySeries, emaSeries, goalWeight]);

  const rangeStartWeight = useMemo(() => {
    const firstEntry = daySeries.find((day) => typeof day.weight === 'number');
    return (firstEntry?.weight ?? null) as number | null;
  }, [daySeries]);

  const rangeLatestWeight = useMemo(() => {
    for (let i = daySeries.length - 1; i >= 0; i -= 1) {
      const value = daySeries[i]?.weight;
      if (typeof value === 'number') return value;
    }
    return null;
  }, [daySeries]);

  const goalProgressPercent = useMemo(
    () => getGoalProgressPercent(rangeStartWeight, rangeLatestWeight, goalWeight),
    [rangeStartWeight, rangeLatestWeight, goalWeight]
  );

  const mealsInRange = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return meals.filter((meal) => meal.timestamp >= startMs && meal.timestamp <= endMs);
  }, [meals, startDate, endDate]);

  const loggedDays = useMemo(() => {
    const days = new Set<string>();
    mealsInRange.forEach((meal) => {
      days.add(toDateKey(new Date(meal.timestamp)));
    });
    return days.size;
  }, [mealsInRange]);

  const totalDays = useMemo(() => getTotalDays(startDate, endDate), [startDate, endDate]);
  const loggedPercent = totalDays > 0 ? Math.min(100, (loggedDays / totalDays) * 100) : 0;

  const isChartLoading = weightLoading && !hasWeightData;
  const hasChartError = Boolean(weightError);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBackground />

      <Animated.View style={styles.screen} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={styles.header} entering={FadeInDown.delay(40).duration(260)}>
            <Text style={styles.title}>Progress</Text>
          </Animated.View>

          <Animated.View style={styles.statRow} entering={FadeInDown.delay(80).duration(260)}>
            <TopStatCard
              label="Last weight"
              value={currentWeight != null ? formatWeight(currentWeight) : '—'}
              ringValue={goalProgressPercent}
              ringColors={RING_COLORS.weight}
              Icon={Scale}
            />
            <TopStatCard
              label="Days logged"
              value={`${loggedDays} logged`}
              ringValue={loggedPercent}
              ringColors={RING_COLORS.days}
              Icon={Apple}
            />
          </Animated.View>

          <Animated.View style={styles.rangeRow} entering={FadeInDown.delay(120).duration(260)}>
            <View style={styles.rangeGroup}>
              {TIMEFRAMES.map((option) => {
                const isActive = option.key === rangeKey;
                return (
                  <Pressable
                    key={option.key}
                    style={({ pressed }) => [
                      styles.rangeChip,
                      isActive && styles.rangeChipActive,
                      pressed && styles.rangeChipPressed,
                    ]}
                    onPress={() => {
                      setRangeKey(option.key);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
                        /* no-op */
                      });
                    }}>
                    <Text style={[styles.rangeChipText, isActive && styles.rangeChipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View style={[styles.card, styles.cardShadow, styles.chartCard]} entering={FadeInDown.delay(160).duration(260)}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>Goal Progress</Text>
              <View style={styles.goalPill}>
                <Pencil size={12} color="#8E8E93" />
                <Text style={styles.goalPillText}>
                  {goalProgressPercent != null ? `${Math.round(goalProgressPercent)}% of goal done` : '—'}
                </Text>
              </View>
            </View>

            {isChartLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Loading weight data...</Text>
              </View>
            ) : hasChartError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Unable to load weight</Text>
                <Text style={styles.emptySubtitle}>{weightError}</Text>
              </View>
            ) : !hasWeightData ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No weigh-ins yet</Text>
                <Text style={styles.emptySubtitle}>Log your weight to see trends.</Text>
              </View>
            ) : (
              <View
                style={styles.chartContainer}
                onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
                <LineChart.Provider
                  data={emaChartData}
                  yRange={yRange}
                  xDomain={[chartDomain.start, chartDomain.end]}>
                  <LineChart height={CHART_HEIGHT} width={chartWidth} yGutter={CHART_Y_GUTTER}>
                    <LineChart.Path color={COLORS.line} width={2.6} />
                    <LineChart.CursorCrosshair color={COLORS.line} outerSize={26} size={6}>
                      <LineChart.Tooltip
                        position="top"
                        yGutter={12}
                        xGutter={12}
                        cursorGutter={22}
                        style={styles.tooltipContainer}>
                        <View style={styles.tooltipContent}>
                          <LineChart.PriceText
                            precision={1}
                            format={formatTooltipValue}
                            style={styles.tooltipValue}
                          />
                        </View>
                      </LineChart.Tooltip>
                    </LineChart.CursorCrosshair>
                  </LineChart>
                </LineChart.Provider>
              </View>
            )}

            {hasWeightData ? (
              <View style={styles.notePill}>
                <Text style={styles.noteText}>Great job! Consistency is key, and you're mastering it!</Text>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function TopStatCard({ label, value, ringValue, ringColors, Icon }: StatCardProps) {
  return (
    <View style={[styles.statCard, styles.cardShadow]}>
      <ProgressRing
        value={ringValue ?? 0}
        size={70}
        strokeWidth={7}
        gradientColors={ringColors}
        backgroundColor={COLORS.ringTrack}>
        <View style={styles.ringIcon}>
          <Icon size={16} color={ringColors[1] ?? COLORS.text} />
        </View>
      </ProgressRing>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function buildDaySeries(start: Date, end: Date, entries: { recordedAt: string; weightKg: number }[]): DayWeight[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const days: DayWeight[] = [];

  const weightByDay: Record<string, { weight: number; timestamp: number }> = {};
  entries.forEach((entry) => {
    const date = new Date(entry.recordedAt);
    const key = toDateKey(date);
    const timestamp = date.getTime();
    const existing = weightByDay[key];
    if (!existing || timestamp > existing.timestamp) {
      weightByDay[key] = { weight: entry.weightKg, timestamp };
    }
  });

  const totalDays = getTotalDays(startDay, endDay);

  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(startDay);
    date.setDate(startDay.getDate() + i);
    const key = toDateKey(date);
    days.push({
      date,
      key,
      weight: weightByDay[key]?.weight ?? null,
    });
  }

  return days;
}

function calculateEmaSeries(series: DayWeight[], alpha: number) {
  let ema: number | null = null;

  return series.map((day) => {
    if (typeof day.weight === 'number') {
      ema = ema == null ? day.weight : day.weight * alpha + ema * (1 - alpha);
    }
    return ema;
  });
}

function getDateRange(days?: number) {
  const endDate = endOfDay(new Date());
  if (!days) {
    return { startDate: startOfDay(ALL_TIME_START), endDate };
  }
  const startDate = startOfDay(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  return { startDate, endDate };
}

function getTotalDays(start: Date, end: Date) {
  const startDay = startOfDay(start).getTime();
  const endDay = startOfDay(end).getTime();
  return Math.floor((endDay - startDay) / (24 * 60 * 60 * 1000)) + 1;
}

function getGoalProgressPercent(
  startWeight: number | null,
  currentWeight: number | null,
  goalWeight: number | null
) {
  if (startWeight == null || currentWeight == null || goalWeight == null) return null;
  if (goalWeight === startWeight) return 100;

  if (goalWeight < startWeight) {
    const total = startWeight - goalWeight;
    if (total <= 0) return null;
    const progress = ((startWeight - currentWeight) / total) * 100;
    return clamp(progress, 0, 100);
  }

  const total = goalWeight - startWeight;
  if (total <= 0) return null;
  const progress = ((currentWeight - startWeight) / total) * 100;
  return clamp(progress, 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeight(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
}

function formatTooltipValue({ value }: { value: string }) {
  'worklet';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  const rounded = Math.round(numeric * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24, // increased from 20
    paddingTop: 10,
    paddingBottom: 40,
    gap: 24, // increased from 14 for better breathing room
  },
  header: {
    marginTop: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 34, // increased from 26
    fontFamily: 'Manrope_800ExtraBold', // bolder
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statRow: {
    flexDirection: 'row',
    gap: 16, // increased from 12
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 24, // increased from 18
    // Removed border for cleaner look or make it very subtle
    borderWidth: 1,
    borderColor: '#F2F2F7',
    paddingVertical: 24, // increased padding
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  ringIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F9',
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.secondary,
    fontFamily: 'Manrope_600SemiBold',
    marginTop: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Manrope_800ExtraBold',
    color: COLORS.text,
  },
  rangeRow: {
    alignItems: 'stretch',
    width: '100%',
  },
  rangeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    padding: 5,
    borderRadius: 20,
    backgroundColor: '#F6F6F8', // Lighter grey background for the group
    width: '100%',
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
  },
  rangeChipActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rangeChipPressed: {
    opacity: 0.8,
  },
  rangeChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: '#8E8E93',
    textAlign: 'center',
  },
  rangeChipTextActive: {
    color: COLORS.text,
    fontFamily: 'Manrope_700Bold',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    padding: 20,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  chartCard: {
    gap: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.text,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F6F6F8', // lighter
    // borderWidth: 0, // cleaner
  },
  goalPillText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.text,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    marginTop: 8,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  tooltipContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  tooltipContent: {
    alignItems: 'center',
  },
  tooltipValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Manrope_700Bold',
  },
  notePill: {
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#EBF9F0', // Slightly more vibrant/lighter green
    borderWidth: 0,
    alignItems: 'center',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2B8A4E', // Darker success text
    fontFamily: 'Manrope_600SemiBold',
    textAlign: 'center',
  },
});
