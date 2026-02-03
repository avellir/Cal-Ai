import * as Haptics from 'expo-haptics';
import { Flame, Target, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { LineChart } from 'react-native-wagmi-charts';
import { DesignColors, Typography } from '@/constants/theme';
import { useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

const COLORS = {
  background: DesignColors.backgroundPrimary,
  card: DesignColors.backgroundSecondary,
  border: DesignColors.backgroundTertiary,
  text: DesignColors.textPrimary,
  secondary: DesignColors.textTertiary,
  accent: DesignColors.info,
  accentSoft: DesignColors.infoBg,
  dot: 'rgba(199, 199, 204, 0.3)',
  success: '#166534',
  successBg: '#E8F5E9',
  warning: '#B45309',
  warningBg: '#FFF8E1',
  neutral: DesignColors.textTertiary,
  neutralBg: DesignColors.backgroundPrimary,
};

type RangeKey = '1w' | '1m' | '3m';

const TIMEFRAMES: { key: RangeKey; label: string; days: number }[] = [
  { key: '1w', label: '1W', days: 7 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
];

const MAINTENANCE_CALORIES = 2500;
const CHART_HEIGHT = 180;
const CHART_Y_GUTTER = 16;
const CHART_X_AXIS_RESERVED_HEIGHT = 40;
const CHART_DRAWING_HEIGHT = CHART_HEIGHT - CHART_X_AXIS_RESERVED_HEIGHT;

type DayWeight = {
  date: Date;
  key: string;
  weight: number | null;
};

type PillTone = 'green' | 'amber' | 'neutral';

type Pill = {
  label: string;
  tone: PillTone;
};

export default function ProgressScreen() {
  const session = useSessionStore((state) => state.session);
  const userId = session?.user?.id ?? null;

  const meals = useMealLogStore((state) => state.meals);
  const mealStatus = useMealLogStore((state) => state.status);
  const mealError = useMealLogStore((state) => state.error);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);

  const { goals, fetchGoals, getDailyTargets } = useUserGoalsStore();
  const { latest, history, fetchRange, isLoading: weightLoading, error: weightError } = useUserWeightLogStore();

  const [rangeKey, setRangeKey] = useState<RangeKey>('1w');
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

  const dailyTargets = getDailyTargets();
  const currentWeight = latest?.weightKg ?? goals?.weightKg ?? null;
  const goalWeight = goals?.targetWeightKg ?? 75;

  const daySeries = useMemo(() => buildDaySeries(startDate, endDate, history), [startDate, endDate, history]);
  const emaSeries = useMemo(() => calculateEmaSeries(daySeries, 0.2), [daySeries]);

  const hasWeightData = daySeries.some((day) => typeof day.weight === 'number');

  const emaChartData = useMemo(() => {
    return daySeries
      .map((day, index) => ({
        timestamp: day.date.getTime(),
        value: emaSeries[index],
      }))
      .filter((point) => typeof point.value === 'number');
  }, [daySeries, emaSeries]);

  const rawDots = useMemo(() => {
    return daySeries
      .filter((day) => typeof day.weight === 'number')
      .map((day) => ({
        timestamp: day.date.getTime(),
        value: day.weight as number,
      }));
  }, [daySeries]);

  const yRange = useMemo(() => {
    const values: number[] = [];
    emaSeries.forEach((value) => {
      if (typeof value === 'number') values.push(value);
    });
    rawDots.forEach((dot) => values.push(dot.value));
    if (goalWeight != null) values.push(goalWeight);
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
  }, [emaSeries, rawDots, goalWeight]);

  const mealsInRange = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return meals.filter((meal) => meal.timestamp >= startMs && meal.timestamp <= endMs);
  }, [meals, startDate, endDate]);

  const { avgCalories, avgProtein } = useMemo(() => {
    const totalsByDay = new Map<string, { calories: number; protein: number }>();
    let caloriesTotal = 0;
    let proteinTotal = 0;

    mealsInRange.forEach((meal) => {
      const key = toDateKey(new Date(meal.timestamp));
      const existing = totalsByDay.get(key) ?? { calories: 0, protein: 0 };
      const next = {
        calories: existing.calories + meal.calories,
        protein: existing.protein + meal.macros.protein,
      };
      totalsByDay.set(key, next);
    });

    totalsByDay.forEach((value) => {
      caloriesTotal += value.calories;
      proteinTotal += value.protein;
    });

    const dayCount = totalsByDay.size;
    if (dayCount === 0) {
      return { avgCalories: null, avgProtein: null };
    }

    return {
      avgCalories: caloriesTotal / dayCount,
      avgProtein: proteinTotal / dayCount,
    };
  }, [mealsInRange]);

  const proteinGoalPercent =
    dailyTargets?.protein && avgProtein != null ? (avgProtein / dailyTargets.protein) * 100 : null;
  const estimatedTdee = goals?.dailyCalories ?? null;

  const caloriePill = getCaloriePill(avgCalories, MAINTENANCE_CALORIES);
  const proteinPill = getProteinPill(proteinGoalPercent);
  const tdeePill = getTdeePill(avgCalories, estimatedTdee);

  const isChartLoading = weightLoading && !hasWeightData;
  const hasChartError = Boolean(weightError);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Animated.View style={styles.screen} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={styles.header} entering={FadeInDown.delay(40).duration(260)}>
            <Text style={styles.title}>Progress</Text>
            <Text style={styles.subtitle}>Track your weight and energy trends over time.</Text>
          </Animated.View>

          <Animated.View style={[styles.card, styles.cardShadow]} entering={FadeInDown.delay(80).duration(260)}>
            <View style={styles.metricRow}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Current Weight</Text>
                <Text style={styles.metricValue}>
                  {currentWeight != null ? formatWeight(currentWeight) : '—'}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Goal</Text>
                <Text style={styles.metricValueSmall}>
                  {goalWeight != null ? formatWeight(goalWeight) : '—'}
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={styles.rangeRow} entering={FadeInDown.delay(120).duration(260)}>
            {TIMEFRAMES.map((option) => {
              const isActive = option.key === rangeKey;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.rangeChip,
                    isActive && styles.rangeChipActive,
                    pressed ? styles.rangeChipPressed : null,
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
          </Animated.View>

          <Animated.View style={[styles.card, styles.cardShadow, styles.chartCard]} entering={FadeInDown.delay(160).duration(260)}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>Weight Trend</Text>
              <Text style={styles.sectionSubtitle}>7-day EMA</Text>
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
            <>
              <View
                style={styles.chartContainer}
                onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
                {goalWeight != null && chartWidth > 0 ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.referenceLine,
                      {
                        top: getYPosition(goalWeight, yRange, CHART_DRAWING_HEIGHT, CHART_Y_GUTTER),
                        width: chartWidth,
                      },
                    ]}
                  />
                ) : null}

                {chartWidth > 0
                  ? rawDots.map((dot) => {
                      const position = getChartPosition(
                        dot.value,
                        dot.timestamp,
                        startDate.getTime(),
                        endDate.getTime(),
                        yRange,
                        chartWidth,
                        CHART_DRAWING_HEIGHT,
                        CHART_Y_GUTTER
                      );
                      if (!position) return null;
                      return (
                        <View
                          key={`dot-${dot.timestamp}`}
                          pointerEvents="none"
                          style={[
                            styles.rawDot,
                            { left: position.x - 3, top: position.y - 3 },
                          ]}
                        />
                      );
                    })
                  : null}

                <LineChart.Provider
                  data={emaChartData}
                  yRange={yRange}
                  xDomain={[startDate.getTime(), endDate.getTime()]}>
                  <LineChart height={CHART_HEIGHT} width={chartWidth} yGutter={CHART_Y_GUTTER}>
                    <LineChart.Path color={COLORS.accent} width={3} />
                    <LineChart.CursorCrosshair>
                      <LineChart.Tooltip
                        textStyle={styles.tooltipText}
                        containerStyle={styles.tooltipContainer}
                      />
                    </LineChart.CursorCrosshair>
                  </LineChart>
                </LineChart.Provider>

                {goalWeight != null && chartWidth > 0 ? (
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.referenceLabel,
                      {
                        top: getYPosition(goalWeight, yRange, CHART_DRAWING_HEIGHT, CHART_Y_GUTTER) - 12,
                        right: 0,
                      },
                    ]}>
                    Goal {formatWeight(goalWeight)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.chartLabelsRow}>
                <Text style={styles.axisLabel}>{formatShortDate(startDate)}</Text>
                <Text style={styles.axisLabel}>{formatShortDate(endDate)}</Text>
              </View>
            </>
          )}
          </Animated.View>

          <Animated.View style={styles.insightGrid} entering={FadeInDown.delay(200).duration(260)}>
            <InsightCard
              label="Avg. Calories"
              value={avgCalories != null ? `${Math.round(avgCalories)} kcal` : '—'}
              pill={caloriePill}
              Icon={Flame}
            />
            <InsightCard
              label="Protein Goal %"
              value={proteinGoalPercent != null ? `${Math.round(proteinGoalPercent)}%` : '—'}
              pill={proteinPill}
              Icon={Target}
            />
            <InsightCard
              label="Estimated TDEE"
              value={estimatedTdee != null ? `${Math.round(estimatedTdee)} kcal` : '—'}
              pill={tdeePill}
              Icon={TrendingUp}
            />
          </Animated.View>

          {mealStatus === 'loading' && meals.length === 0 ? (
            <Text style={styles.mealNote}>Loading nutrition data…</Text>
          ) : mealError ? (
            <Text style={styles.mealNote}>{mealError}</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function InsightCard({
  label,
  value,
  pill,
  Icon,
}: {
  label: string;
  value: string;
  pill: Pill;
  Icon: LucideIcon;
}) {
  const pillStyles = getPillStyles(pill.tone);

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <View style={styles.iconBubble}>
          <Icon size={16} color={COLORS.accent} />
        </View>
        <Text style={styles.insightLabel}>{label}</Text>
      </View>
      <Text style={styles.insightValue}>{value}</Text>
      <View style={[styles.pill, pillStyles.container]}>
        <Text style={[styles.pillText, pillStyles.text]}>{pill.label}</Text>
      </View>
    </View>
  );
}

function getCaloriePill(avgCalories: number | null, maintenanceCalories: number) {
  if (avgCalories == null) {
    return { label: 'No Data', tone: 'neutral' as const };
  }
  if (avgCalories < maintenanceCalories) {
    return { label: 'Caloric Deficit', tone: 'amber' as const };
  }
  return { label: 'On Track', tone: 'green' as const };
}

function getProteinPill(proteinPercent: number | null) {
  if (proteinPercent == null) {
    return { label: 'No Data', tone: 'neutral' as const };
  }
  if (proteinPercent >= 80) {
    return { label: 'On Track', tone: 'green' as const };
  }
  return { label: 'Below Target', tone: 'amber' as const };
}

function getTdeePill(avgCalories: number | null, tdee: number | null) {
  if (avgCalories == null || tdee == null || tdee === 0) {
    return { label: 'No Data', tone: 'neutral' as const };
  }
  const ratio = avgCalories / tdee;
  if (ratio >= 0.9 && ratio <= 1.1) {
    return { label: 'On Track', tone: 'green' as const };
  }
  if (ratio < 0.9) {
    return { label: 'Below Target', tone: 'amber' as const };
  }
  return { label: 'Above Target', tone: 'amber' as const };
}

function getPillStyles(tone: PillTone) {
  if (tone === 'green') {
    return {
      container: { backgroundColor: COLORS.successBg },
      text: { color: COLORS.success },
    };
  }
  if (tone === 'amber') {
    return {
      container: { backgroundColor: COLORS.warningBg },
      text: { color: COLORS.warning },
    };
  }
  return {
    container: { backgroundColor: COLORS.neutralBg },
    text: { color: COLORS.neutral },
  };
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

  const totalDays =
    Math.floor((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;

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

function getDateRange(days: number) {
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  return { startDate, endDate };
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

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeight(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
}

function getChartPosition(
  value: number,
  timestamp: number,
  startTimestamp: number,
  endTimestamp: number,
  stats: { min: number; max: number },
  width: number,
  height: number,
  yGutter: number
) {
  if (width <= 0 || endTimestamp === startTimestamp) return null;
  const xRatio = (timestamp - startTimestamp) / (endTimestamp - startTimestamp);
  const clampedX = Math.max(0, Math.min(1, xRatio));
  const yRatio = (value - stats.min) / (stats.max - stats.min);
  const clampedY = Math.max(0, Math.min(1, yRatio));
  const heightBetweenGutters = height - yGutter * 2;
  return {
    x: clampedX * width,
    y: yGutter + (1 - clampedY) * heightBetweenGutters,
  };
}

function getYPosition(value: number, stats: { min: number; max: number }, height: number, yGutter: number) {
  const ratio = (value - stats.min) / (stats.max - stats.min);
  const clamped = Math.max(0, Math.min(1, ratio));
  const heightBetweenGutters = height - yGutter * 2;
  return yGutter + (1 - clamped) * heightBetweenGutters;
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
    gap: 6,
  },
  metricLabel: {
    ...Typography.caption,
    color: DesignColors.textTertiary,
  },
  metricValue: {
    ...Typography.displayMedium,
    color: DesignColors.textPrimary,
  },
  metricValueSmall: {
    ...Typography.displayMedium,
    color: DesignColors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  rangeChipActive: {
    borderColor: DesignColors.primary900,
    backgroundColor: DesignColors.primary900,
  },
  rangeChipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  rangeChipText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  rangeChipTextActive: {
    color: DesignColors.textInverse,
  },
  chartCard: {
    gap: 16,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  axisLabel: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  referenceLabel: {
    position: 'absolute',
    fontSize: 10,
    color: COLORS.secondary,
  },
  referenceLine: {
    position: 'absolute',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(142, 142, 147, 0.35)',
  },
  rawDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.dot,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.secondary,
  },
  tooltipContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tooltipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightCard: {
    flexBasis: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightLabel: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  insightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mealNote: {
    fontSize: 12,
    color: COLORS.secondary,
    textAlign: 'center',
  },
});
