import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Droplet, Fish, Leaf, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MacroStatCard } from '@/components/MacroStatCard';
import { AppBackground } from '@/components/ui/AppBackground';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Shimmer } from '@/components/ui/Shimmer';
import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';
import { resolveImageUri, useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { aggregateDailyNutrition } from '@/services/nutritionAggregation';
import { useUserGoalsStore } from '@/store/userGoalsStore';

type MacroKey = 'protein' | 'carbs' | 'fat';

type MacroCardConfig = {
  key: MacroKey;
  label: string;
  Icon: LucideIcon;
  iconColor: string;
};

const MACRO_CONFIGS: MacroCardConfig[] = [
  {
    key: 'protein',
    label: 'Protein',
    Icon: Fish,
    iconColor: DesignColors.protein,
  },
  {
    key: 'carbs',
    label: 'Carbs',
    Icon: Leaf,
    iconColor: DesignColors.carbs,
  },
  {
    key: 'fat',
    label: 'Fat',
    Icon: Droplet,
    iconColor: DesignColors.fat,
  },
];

const DAY_PILL_WIDTH = 56;
const DAY_PILL_HEIGHT = 64;
const DAY_PILL_GAP = Spacing.sm;

type DayItem = {
  date: Date;
  label: string;
  day: string;
  isToday: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const session = useSessionStore((state) => state.session);
  const meals = useMealLogStore((state) => state.meals);
  const status = useMealLogStore((state) => state.status);
  const mealError = useMealLogStore((state) => state.error);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);
  const userId = session?.user?.id ?? null;

  const dates = useMemo(() => getRecentDates(7), []);
  const todayIndex = dates.findIndex((item) => item.isToday);
  const initialIndex = todayIndex >= 0 ? todayIndex : dates.length - 1;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<DayItem>>(null);
  const dayLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const highlightX = useSharedValue(0);
  const highlightWidth = useSharedValue(DAY_PILL_WIDTH);

  // Get the 2 most recent meals
  const recentMeals = meals.slice(0, 2);

  // User goals state
  const fetchGoals = useUserGoalsStore((state) => state.fetchGoals);
  const hasGoals = useUserGoalsStore((state) => state.hasGoals);
  const getDailyTargets = useUserGoalsStore((state) => state.getDailyTargets);

  // Calculate daily nutrition totals and remaining values
  const dailyTotals = aggregateDailyNutrition(meals);
  const dailyTargets = getDailyTargets();

  // Calculate remaining calories and macros
  const caloriesRemaining = dailyTargets
    ? Math.max(0, dailyTargets.calories - dailyTotals.calories)
    : 0;
  const proteinRemaining = dailyTargets
    ? Math.max(0, dailyTargets.protein - dailyTotals.protein)
    : 0;
  const carbsRemaining = dailyTargets
    ? Math.max(0, dailyTargets.carbs - dailyTotals.carbs)
    : 0;
  const fatRemaining = dailyTargets
    ? Math.max(0, dailyTargets.fat - dailyTotals.fat)
    : 0;

  // Calculate percentage consumed for progress ring
  const percentageConsumed = dailyTargets && dailyTargets.calories > 0
    ? Math.min(100, Math.round((dailyTotals.calories / dailyTargets.calories) * 100))
    : 0;

  const macroProgress = {
    protein: dailyTargets && dailyTargets.protein > 0 ? Math.min(1, dailyTotals.protein / dailyTargets.protein) : 0,
    carbs: dailyTargets && dailyTargets.carbs > 0 ? Math.min(1, dailyTotals.carbs / dailyTargets.carbs) : 0,
    fat: dailyTargets && dailyTargets.fat > 0 ? Math.min(1, dailyTotals.fat / dailyTargets.fat) : 0,
  };

  const hasGoalsValue = hasGoals();

  const guidanceMessage = hasGoalsValue
    ? null // Will render formatted text inline
    : 'Set your goals to see personalized guidance.';

  const calorieAnim = useSharedValue(0);
  const [calorieDisplay, setCalorieDisplay] = useState(0);

  const updateHighlight = (index: number) => {
    const layout = dayLayouts.current[index];
    if (!layout) return;
    highlightX.value = withSpring(layout.x, { damping: 18, stiffness: 160 });
    highlightWidth.value = withSpring(layout.width, { damping: 18, stiffness: 160 });
  };

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
    width: highlightWidth.value,
  }));

  const fabBaseScale = useSharedValue(0.8);
  const fabPressScale = useSharedValue(1);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabBaseScale.value * fabPressScale.value },
    ],
  }));

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetchMeals(userId).catch((error) => {
      console.error('Failed to load meals', error);
    });

    // Fetch user goals
    fetchGoals(userId).catch((error) => {
      console.error('Failed to load goals', error);
    });
  }, [userId, fetchMeals, fetchGoals]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToIndex({ index: selectedIndex, animated: true, viewPosition: 0.5 });
    updateHighlight(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    fabBaseScale.value = withSpring(1, { damping: 14, stiffness: 160 });
  }, [fabBaseScale]);

  useEffect(() => {
    if (!hasGoalsValue) {
      setCalorieDisplay(0);
      return;
    }
    calorieAnim.value = 0;
    calorieAnim.value = withTiming(caloriesRemaining, { duration: 800 });
  }, [caloriesRemaining, hasGoalsValue, calorieAnim]);

  useAnimatedReaction(
    () => Math.round(calorieAnim.value),
    (value, previous) => {
      if (value === previous) return;
      runOnJS(setCalorieDisplay)(value);
    }
  );

  const isInitialLoading = status === 'loading' && meals.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Animated.View style={styles.root} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
        <AppBackground />
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}>
          <Animated.View style={styles.headerRow} entering={FadeInDown.delay(40).duration(260)}>
            <View style={styles.brandRow}>
              <Text style={styles.brandEmoji}>🍎</Text>
              <Text style={styles.brandText}>Cal AI</Text>
            </View>
            <View style={styles.streakPill}>
              <Feather name="zap" size={16} color={DesignColors.warning} />
              <Text style={styles.streakValue}>0</Text>
            </View>
          </Animated.View>

          <View style={styles.dayStripWrapper}>
            <Animated.View pointerEvents="none" style={[styles.dayPillHighlight, highlightStyle]} />
            <Animated.FlatList
              ref={listRef}
              data={dates}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.date.toISOString()}
              contentContainerStyle={styles.dayStrip}
              renderItem={({ item, index }) => (
                <DatePill
                  item={item}
                  index={index}
                  isSelected={index === selectedIndex}
                  onSelect={setSelectedIndex}
                  onLayoutItem={(layout) => {
                    dayLayouts.current[index] = layout;
                    if (index === selectedIndex) {
                      updateHighlight(index);
                    }
                  }}
                />
              )}
              getItemLayout={(_, index) => ({
                length: DAY_PILL_WIDTH + DAY_PILL_GAP,
                offset: (DAY_PILL_WIDTH + DAY_PILL_GAP) * index,
                index,
              })}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                }, 100);
              }}
            />
          </View>

          <Animated.View entering={FadeInDown.delay(80).duration(260)}>
            <Card elevation="md" style={styles.calorieCard}>
            <View style={styles.calorieCopy}>
              {hasGoalsValue ? (
                <>
                  <Text style={styles.overline}>Today</Text>
                  <Text style={styles.calorieValue}>{calorieDisplay}</Text>
                  <Text style={styles.calorieLabel}>Calories left</Text>
                </>
              ) : (
                <>
                  <Text style={styles.overline}>Goals</Text>
                  <Text style={styles.calorieValue}>Set Goals</Text>
                  <Text style={styles.calorieLabel}>Tap to configure your targets</Text>
                </>
              )}
            </View>
            <View style={styles.ringWrapper}>
              <ProgressRing
                value={hasGoalsValue ? percentageConsumed : 0}
                size={120}
                strokeWidth={14}
                gradientColors={DesignColors.calorieRing}
                backgroundColor={DesignColors.backgroundTertiary}>
                <View style={styles.ringContent}>
                  <Text style={styles.ringPercent}>{hasGoalsValue ? `${percentageConsumed}%` : ''}</Text>
                  <Text style={styles.ringUnit}>of goal</Text>
                </View>
              </ProgressRing>
            </View>
            </Card>
          </Animated.View>

          <Text style={styles.guidanceText}>
            {hasGoalsValue
              ? `You are on track with ${Math.round(caloriesRemaining)} calories remaining.`
              : 'Set your goals to see personalized guidance.'}
          </Text>

          <Animated.View style={styles.macroRow}>
            {MACRO_CONFIGS.map((config, index) => {
              let value = '0g';
              let progressValue = 0;
              if (hasGoalsValue) {
                if (config.key === 'protein') {
                  value = `${Math.round(proteinRemaining)}`;
                  progressValue = macroProgress.protein;
                } else if (config.key === 'carbs') {
                  value = `${Math.round(carbsRemaining)}`;
                  progressValue = macroProgress.carbs;
                } else if (config.key === 'fat') {
                  value = `${Math.round(fatRemaining)}`;
                  progressValue = macroProgress.fat;
                }
              }

              return (
                <Animated.View
                  key={config.label}
                  entering={FadeInDown.delay(140 + index * 100).duration(260)}
                  style={styles.macroCardWrapper}>
                  <MacroStatCard
                    label={config.label}
                    value={Number.parseFloat(value) || 0}
                    percent={progressValue * 100}
                    color={config.iconColor}
                    Icon={config.Icon}
                  />
                </Animated.View>
                );
              })}
          </Animated.View>

          <Animated.View style={styles.recentSection} entering={FadeInDown.delay(200).duration(260)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently logged</Text>
              {meals.length > 0 && (
                <Pressable onPress={() => router.push('/(app)/meal-history')}>
                  <Text style={styles.seeAllText}>See all</Text>
                </Pressable>
              )}
            </View>
            {isInitialLoading ? (
              <View style={styles.recentEmptyCard}>
                <ActivityIndicator size="small" color={DesignColors.black} />
                <Text style={styles.recentNote}>Loading your latest meals...</Text>
              </View>
            ) : mealError ? (
              <View style={styles.recentEmptyCard}>
                <Text style={styles.recentHeadline}>Unable to load meals</Text>
                <Text style={styles.recentNote}>{mealError}</Text>
              </View>
            ) : recentMeals.length > 0 ? (
              <View style={styles.recentMealsList}>
                {recentMeals.map((meal, index) => {
                  // Resolve image URI with cache-first logic (Requirements 2.2, 2.3)
                  const resolvedImageUri = resolveImageUri(meal.imageUri, meal.imageUrl);
                  return (
                  <Animated.View
                    key={meal.id}
                    entering={FadeInDown.delay(200 + index * 60).duration(240)}
                    style={styles.recentCard}>
                    <View style={styles.recentRow}>
                      <MealImage uri={resolvedImageUri} />
                      <View style={styles.recentContent}>
                        <View style={styles.recentHeader}>
                          <Text style={styles.recentHeadline} numberOfLines={1}>{meal.name}</Text>
                          <Pressable style={styles.recentMoreBtn}>
                            <Feather name="more-horizontal" size={20} color={DesignColors.gray400} />
                          </Pressable>
                        </View>
                        <Text style={styles.recentTimestamp}>{formatMealTimestamp(meal.timestamp)}</Text>
                        <View style={styles.recentMacroRow}>
                          <Text style={styles.recentMacroItem}>🔥 {Math.round(meal.calories)} Cal</Text>
                          <Text style={styles.recentMacroItem}>🍗 {Math.round(meal.macros.protein)}g</Text>
                          <Text style={styles.recentMacroItem}>🌾 {Math.round(meal.macros.carbs)}g</Text>
                          <Text style={styles.recentMacroItem}>🥑 {Math.round(meal.macros.fat)}g</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.recentEmptyCard}>
                <Text style={styles.recentHeadline}>No meals logged yet</Text>
                <Text style={styles.recentNote}>
                  Capture a meal or add one manually to see it here.
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.ScrollView>

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Add a new entry"
          style={[styles.fab, fabAnimatedStyle]}
          onPress={() => router.push('/(app)/camera')}
          onPressIn={() => {
            fabPressScale.value = withSpring(0.95, { damping: 16, stiffness: 180 });
          }}
          onPressOut={() => {
            fabPressScale.value = withSpring(1, { damping: 16, stiffness: 180 });
          }}>
          <Feather name="plus" size={24} color={DesignColors.white} />
          <Text style={styles.fabLabel}>Add meal</Text>
        </AnimatedPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function DatePill({
  item,
  index,
  isSelected,
  onSelect,
  onLayoutItem,
}: {
  item: DayItem;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onLayoutItem: (layout: { x: number; width: number }) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.dayPillWrapper, animatedStyle]}
      onLayout={(event) => onLayoutItem(event.nativeEvent.layout)}>
      <Pressable
        onPress={() => onSelect(index)}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 16, stiffness: 180 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 180 });
        }}
        style={[styles.dayPill, isSelected && styles.dayPillActive]}>
        <Text style={[styles.dayPillLabel, isSelected && styles.dayPillLabelActive]}>
          {item.label}
        </Text>
        <Text style={[styles.dayPillNumber, isSelected && styles.dayPillNumberActive]}>
          {item.day}
        </Text>
        {item.isToday ? <View style={styles.todayDot} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function MealImage({ uri }: { uri?: string | null }) {
  const [loaded, setLoaded] = useState(false);

  if (!uri) {
    return (
      <View style={styles.recentImagePlaceholder}>
        <Text style={styles.recentImageEmoji}>🍽️</Text>
      </View>
    );
  }

  return (
    <View style={styles.recentImageWrapper}>
      {!loaded ? <Shimmer style={styles.recentImage} /> : null}
      <Image
        source={{ uri }}
        style={[styles.recentImage, !loaded && styles.imageHidden]}
        onLoadEnd={() => setLoaded(true)}
      />
    </View>
  );
}

function formatMealTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();

  const isToday = date.toDateString() === today.toDateString();
  const dayFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dayLabel = isToday ? 'Today' : dayFormatter.format(date);
  return `${dayLabel} • ${timeFormatter.format(date)}`;
}

type ParsedIngredient = {
  name: string;
  quantity: string;
};

function parseMealDescription(text?: string | null): ParsedIngredient[] {
  if (!text) return [];

  return text
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const dividerMatch = part.match(/^(.*?)[-:]+\s*(.+)$/);
      if (dividerMatch) {
        return {
          name: dividerMatch[1].trim(),
          quantity: dividerMatch[2].trim(),
        };
      }

      const lastSpace = part.lastIndexOf(' ');
      if (lastSpace > 0) {
        return {
          name: part.slice(0, lastSpace).trim(),
          quantity: part.slice(lastSpace + 1).trim(),
        };
      }

      return { name: part, quantity: '' };
    });
}

function getRecentDates(days: number): DayItem[] {
  const today = new Date();
  const items: DayItem[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const label = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
      .format(date)
      .slice(0, 1)
      .toUpperCase();
    items.push({
      date,
      label,
      day: `${date.getDate()}`,
      isToday: date.toDateString() === today.toDateString(),
    });
  }
  return items;
}

function IngredientList({ description }: { description?: string | null }) {
  const ingredients = parseMealDescription(description);
  if (!ingredients.length) return null;

  return (
    <View style={styles.ingredientList}>
      {ingredients.map((item, index) => {
        const isLast = index === ingredients.length - 1;
        return (
          <View
            key={`${item.name}-${index}`}
            style={[styles.ingredientRow, isLast && styles.ingredientRowLast]}>
            <Text style={styles.ingredientName}>{item.name}</Text>
            <Text style={styles.ingredientQuantity}>{item.quantity || '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandEmoji: {
    fontSize: 24,
  },
  brandText: {
    ...Typography.h2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.warningBg,
  },
  streakValue: {
    color: DesignColors.warningDark,
    fontWeight: '700',
  },
  dayStripWrapper: {
    position: 'relative',
  },
  dayStrip: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  dayPillHighlight: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    height: DAY_PILL_HEIGHT,
    borderRadius: BorderRadius.lg,
    backgroundColor: DesignColors.primaryBg,
  },
  dayPillWrapper: {
    width: DAY_PILL_WIDTH,
    height: DAY_PILL_HEIGHT,
    marginRight: DAY_PILL_GAP,
  },
  dayPill: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DesignColors.backgroundSecondary,
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dayPillActive: {
    borderColor: 'transparent',
    backgroundColor: DesignColors.primary900,
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dayPillLabel: {
    ...Typography.caption,
    color: DesignColors.textSecondary,
  },
  dayPillLabelActive: {
    color: DesignColors.textInverse,
  },
  dayPillNumber: {
    ...Typography.bodyBold,
    color: DesignColors.textPrimary,
  },
  dayPillNumberActive: {
    color: DesignColors.textInverse,
  },
  todayDot: {
    marginTop: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DesignColors.info,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DesignColors.backgroundSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  overline: {
    ...Typography.caption,
    color: DesignColors.textTertiary,
  },
  calorieCopy: {
    gap: 6,
  },
  calorieValue: {
    ...Typography.displayLarge,
    color: DesignColors.textPrimary,
  },
  calorieLabel: {
    ...Typography.bodyMedium,
    color: DesignColors.textSecondary,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ringPercent: {
    ...Typography.bodyBold,
    color: DesignColors.textPrimary,
  },
  ringUnit: {
    ...Typography.caption,
    color: DesignColors.textTertiary,
  },
  guidanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.gray600,
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCardWrapper: {
    flex: 1,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.sm,
  },
  macroBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    ...Typography.displayMedium,
    color: DesignColors.black,
  },
  macroLabel: {
    ...Typography.caption,
    textAlign: 'left',
    color: DesignColors.gray600,
  },
  recentSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    color: DesignColors.black,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    color: DesignColors.primary,
    fontWeight: '600',
  },
  recentMealsList: {
    gap: 12,
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  recentEmptyCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.backgroundTertiary,
    paddingBottom: 8,
  },
  recentImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  recentImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageHidden: {
    opacity: 0,
  },
  recentImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: DesignColors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentImageEmoji: {
    fontSize: 24,
  },
  recentContent: {
    flex: 1,
    gap: 4,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeadline: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DesignColors.textPrimary,
    flex: 1,
  },
  recentMoreBtn: {
    padding: 4,
  },
  recentTimestamp: {
    ...Typography.bodySmall,
    color: DesignColors.textTertiary,
  },
  recentMacroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  recentMacroItem: {
    ...Typography.bodyMedium,
    color: DesignColors.textSecondary,
  },
  recentNote: {
    fontSize: 14,
    color: DesignColors.gray500,
    lineHeight: 20,
  },
  ingredientList: {
    marginTop: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.backgroundTertiary,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    ...Typography.bodySmallBold,
    color: DesignColors.black,
    flex: 1,
    paddingRight: 8,
  },
  ingredientQuantity: {
    ...Typography.bodySmall,
    color: DesignColors.gray600,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    paddingHorizontal: 20,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  fabLabel: {
    ...Typography.bodyBold,
    color: DesignColors.white,
  },
});
