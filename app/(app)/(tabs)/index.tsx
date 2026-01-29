import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Droplet, Fish, Leaf, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroStatCard } from '@/components/MacroStatCard';
import { AppBackground } from '@/components/ui/AppBackground';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';
import { resolveImageUri, useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { aggregateDailyNutrition } from '@/services/nutritionAggregation';
import { useUserGoalsStore } from '@/store/userGoalsStore';

const DAYS = [
  { label: 'T', date: '22', state: 'past' as const },
  { label: 'W', date: '23', state: 'past' as const },
  { label: 'T', date: '24', state: 'past' as const },
  { label: 'F', date: '25', state: 'past' as const },
  { label: 'S', date: '26', state: 'past' as const },
  { label: 'S', date: '27', state: 'active' as const },
  { label: 'M', date: '28', state: 'future' as const },
];

type MacroKey = 'protein' | 'carbs' | 'fat';

type MacroCardConfig = {
  key: MacroKey;
  label: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
};

const MACRO_CONFIGS: MacroCardConfig[] = [
  {
    key: 'protein',
    label: 'Protein',
    Icon: Fish,
    iconColor: DesignColors.protein,
    iconBg: '#FFE8EC',
  },
  {
    key: 'carbs',
    label: 'Carbs',
    Icon: Leaf,
    iconColor: DesignColors.carbs,
    iconBg: '#FFF4D5',
  },
  {
    key: 'fat',
    label: 'Fat',
    Icon: Droplet,
    iconColor: DesignColors.fat,
    iconBg: '#E8F1FF',
  },
];

export default function HomeScreen() {
  const session = useSessionStore((state) => state.session);
  const meals = useMealLogStore((state) => state.meals);
  const status = useMealLogStore((state) => state.status);
  const mealError = useMealLogStore((state) => state.error);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);
  const userId = session?.user?.id ?? null;
  
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

  const guidanceMessage = hasGoals()
    ? null // Will render formatted text inline
    : 'Set your goals to see personalized guidance.';

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

  const isInitialLoading = status === 'loading' && meals.length === 0;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <AppBackground />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Text style={styles.brandEmoji}>🍎</Text>
              <Text style={styles.brandText}>Cal AI</Text>
            </View>
            <View style={styles.streakPill}>
              <Feather name="zap" size={16} color={DesignColors.warning} />
              <Text style={styles.streakValue}>0</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}>
            {DAYS.map((day) => {
              const isActive = day.state === 'active';
              const isFuture = day.state === 'future';
              return (
                <Pressable
                  key={`${day.label}-${day.date}`}
                  style={[
                    styles.dayPill,
                    isActive && styles.dayPillActive,
                    isFuture && styles.dayPillFuture,
                  ]}>
                  <Text style={[styles.dayPillLabel, isActive && styles.dayPillLabelActive, isFuture && styles.dayPillLabelFuture]}>
                    {day.label}
                  </Text>
                  <Text style={[styles.dayPillNumber, isActive && styles.dayPillNumberActive, isFuture && styles.dayPillNumberFuture]}>
                    {day.date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Card elevation="md" style={styles.calorieCard}>
            <View style={styles.calorieCopy}>
              {hasGoals() ? (
                <>
                  <Text style={styles.overline}>Today</Text>
                  <Text style={styles.calorieValue}>{Math.round(caloriesRemaining)}</Text>
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
                value={hasGoals() ? percentageConsumed : 0}
                size={120}
                strokeWidth={10}
                color={DesignColors.primary}
                backgroundColor={DesignColors.gray200}>
                <View style={styles.ringContent}>
                  <Text style={styles.ringPercent}>{hasGoals() ? `${percentageConsumed}%` : ''}</Text>
                  <Text style={styles.ringUnit}>of goal</Text>
                </View>
              </ProgressRing>
            </View>
          </Card>

          <Text style={styles.guidanceText}>
            {hasGoals()
              ? `You are on track with ${Math.round(caloriesRemaining)} calories remaining.`
              : 'Set your goals to see personalized guidance.'}
          </Text>

          <View style={styles.macroRow}>
            {MACRO_CONFIGS.map((config, index) => {
              let value = '0g';
              let progressValue = 0;
              if (hasGoals()) {
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
                <MacroStatCard
                  key={config.label}
                  label={config.label}
                  value={Number.parseFloat(value) || 0}
                  percent={progressValue * 100}
                  color={config.iconColor}
                  iconBg={config.iconBg}
                  Icon={config.Icon}
                />
              );
            })}
          </View>

          <View style={styles.recentSection}>
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
                {recentMeals.map((meal) => {
                  // Resolve image URI with cache-first logic (Requirements 2.2, 2.3)
                  const resolvedImageUri = resolveImageUri(meal.imageUri, meal.imageUrl);
                  return (
                  <View key={meal.id} style={styles.recentCard}>
                    <View style={styles.recentRow}>
                      {resolvedImageUri ? (
                        <Image source={{ uri: resolvedImageUri }} style={styles.recentImage} />
                      ) : (
                        <View style={styles.recentImagePlaceholder}>
                          <Text style={styles.recentImageEmoji}>🍽️</Text>
                        </View>
                      )}
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
                  </View>
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
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a new entry"
          style={styles.fab}
          onPress={() => router.push('/(app)/camera')}>
          <Feather name="plus" size={24} color={DesignColors.white} />
          <Text style={styles.fabLabel}>Add meal</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
  dayStrip: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  dayPill: {
    width: 56,
    height: 64,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    backgroundColor: DesignColors.white,
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dayPillActive: {
    borderColor: DesignColors.primary,
    backgroundColor: DesignColors.primaryBg,
  },
  dayPillFuture: {
    opacity: 0.7,
  },
  dayPillLabel: {
    ...Typography.caption,
    color: DesignColors.gray600,
  },
  dayPillLabelActive: {
    color: DesignColors.primaryDark,
  },
  dayPillLabelFuture: {
    color: DesignColors.gray400,
  },
  dayPillNumber: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  dayPillNumberActive: {
    color: DesignColors.primaryDark,
  },
  dayPillNumberFuture: {
    color: DesignColors.gray400,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overline: {
    ...Typography.label,
    color: DesignColors.gray500,
  },
  calorieCopy: {
    gap: 6,
  },
  calorieValue: {
    ...Typography.displayMedium,
    color: DesignColors.black,
  },
  calorieLabel: {
    ...Typography.bodySmall,
    color: DesignColors.gray600,
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
    color: DesignColors.black,
  },
  ringUnit: {
    ...Typography.caption,
    color: DesignColors.gray500,
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
  },
  recentImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
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
    fontSize: 16,
    color: DesignColors.black,
    fontWeight: '700',
    flex: 1,
  },
  recentMoreBtn: {
    padding: 4,
  },
  recentTimestamp: {
    fontSize: 13,
    color: DesignColors.gray500,
  },
  recentMacroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  recentMacroItem: {
    fontSize: 13,
    color: DesignColors.black,
    fontWeight: '500',
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
    borderBottomColor: DesignColors.gray100,
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
    paddingHorizontal: Spacing.lg,
    height: 64,
    borderRadius: BorderRadius.round,
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
