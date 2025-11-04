import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMealLogStore } from '@/lib/meal-log-store';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type MacroCardConfig = {
  label: string;
  icon: IoniconName;
  iconColor: string;
  badgeColor: string;
};

const MACRO_CONFIGS: MacroCardConfig[] = [
  {
    label: 'Protein left',
    icon: 'fish',
    iconColor: '#FF7A7A',
    badgeColor: '#FFEFF1',
  },
  {
    label: 'Carbs left',
    icon: 'leaf',
    iconColor: '#7C8BFF',
    badgeColor: '#EEF0FF',
  },
  {
    label: 'Fat left',
    icon: 'water',
    iconColor: '#48C7F0',
    badgeColor: '#E6F7FF',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const session = useSessionStore((state) => state.session);
  const meals = useMealLogStore((state) => state.meals);
  const status = useMealLogStore((state) => state.status);
  const mealError = useMealLogStore((state) => state.error);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);
  const userId = session?.user?.id ?? null;
  const gradientHeight = insets.top + Math.round(Dimensions.get('window').height * 0.40);
  const bottomGradientHeight = Math.round(Dimensions.get('window').height * 0.15);
  const recentMeal = meals[0] ?? null;

  // User goals state
  const goals = useUserGoalsStore((state) => state.goals);
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

  const mealDisplay = recentMeal
    ? {
        title: recentMeal.name,
        note: recentMeal.note ?? 'Captured via Cal AI camera',
        timestamp: formatMealTimestamp(recentMeal.timestamp),
        calories: `${Math.round(recentMeal.calories)} kcal`,
        macros: [
          { label: 'Protein', value: `${Math.round(recentMeal.macros.protein)}g` },
          { label: 'Carbs', value: `${Math.round(recentMeal.macros.carbs)}g` },
          { label: 'Fat', value: `${Math.round(recentMeal.macros.fat)}g` },
        ],
      }
    : null;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <LinearGradient
          colors={[
            'rgba(248, 250, 252, 0.8)',
            'rgba(248, 250, 252, 0.6)',
            'rgba(249, 250, 251, 0.4)',
            'rgba(252, 252, 253, 0.2)',
            'rgba(255, 255, 255, 0)',
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            {
              height: gradientHeight,
              top: -insets.top,
            },
          ]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0)',
            'rgba(250, 250, 250, 0.3)',
            'rgba(248, 248, 248, 0.6)',
            '#ffffff',
          ]}
          locations={[0, 0.3, 0.7, 1]}
          style={[
            styles.bottomGradient,
            {
              height: bottomGradientHeight,
            },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Text style={styles.brandEmoji}>🍎</Text>
              <Text style={styles.brandText}>Cal AI</Text>
            </View>
            <View style={styles.streakPill}>
              <Feather name="flame" size={16} color="#FF7A00" />
              <Text style={styles.streakValue}>0</Text>
            </View>
          </View>

          <View style={styles.dayStrip}>
            {DAYS.map((day) => {
              const isActive = day.state === 'active';
              const isFuture = day.state === 'future';
              return (
                <View key={`${day.label}-${day.date}`} style={styles.dayItem}>
                  <View
                    style={[
                      styles.dayBadge,
                      isActive && styles.dayBadgeActive,
                      isFuture && styles.dayBadgeFuture,
                    ]}>
                    <Text
                      style={[
                        styles.dayLabel,
                        isActive && styles.dayLabelActive,
                        isFuture && styles.dayLabelFuture,
                      ]}>
                      {day.label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.dayNumber,
                      isActive && styles.dayNumberActive,
                      isFuture && styles.dayNumberFuture,
                    ]}>
                    {day.date}
                  </Text>
                </View>
              );
            })}
          </View>

          <Pressable
            style={styles.calorieCard}
            onPress={() => {
              if (!hasGoals()) {
                router.push('/goal-flow/height-weight' as any);
              }
            }}
            disabled={hasGoals()}>
            <View style={styles.calorieCopy}>
              {hasGoals() ? (
                <>
                  <Text style={styles.calorieValue}>{Math.round(caloriesRemaining)}</Text>
                  <Text style={styles.calorieLabel}>Calories left</Text>
                </>
              ) : (
                <>
                  <Text style={styles.calorieValue}>Set Goals</Text>
                  <Text style={styles.calorieLabel}>Tap to configure your targets</Text>
                </>
              )}
            </View>
            <View style={styles.calorieRing}>
              <View 
                style={[
                  styles.calorieRingProgress,
                  {
                    transform: [{ rotate: `${(percentageConsumed * 3.6) - 90}deg` }],
                    opacity: hasGoals() ? 1 : 0,
                  }
                ]}
              />
              <View style={styles.calorieRingInner}>
                <Feather name="flame" size={24} color="#11181C" />
              </View>
            </View>
          </Pressable>

          <View style={styles.macroRow}>
            {MACRO_CONFIGS.map((config, index) => {
              let value = '0g';
              
              if (hasGoals()) {
                if (index === 0) {
                  // Protein
                  value = `${Math.round(proteinRemaining)}g`;
                } else if (index === 1) {
                  // Carbs
                  value = `${Math.round(carbsRemaining)}g`;
                } else if (index === 2) {
                  // Fat
                  value = `${Math.round(fatRemaining)}g`;
                }
              }
              
              return (
                <View key={config.label} style={styles.macroCard}>
                  <View style={[styles.macroBadge, { backgroundColor: config.badgeColor }]}>
                    <Ionicons name={config.icon} size={18} color={config.iconColor} />
                  </View>
                  <Text style={styles.macroValue}>{value}</Text>
                  <Text style={styles.macroLabel}>{config.label}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.carouselDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recently logged</Text>
            {isInitialLoading ? (
              <View style={styles.recentEmptyCard}>
                <ActivityIndicator size="small" color="#11181C" />
                <Text style={styles.recentNote}>Loading your latest meals...</Text>
              </View>
            ) : mealError ? (
              <View style={styles.recentEmptyCard}>
                <Text style={styles.recentHeadline}>Unable to load meals</Text>
                <Text style={styles.recentNote}>{mealError}</Text>
              </View>
            ) : mealDisplay ? (
              <View style={styles.recentCard}>
                <View style={styles.recentRow}>
                  <View style={styles.recentDetails}>
                    <Text style={styles.recentHeadline}>{mealDisplay.title}</Text>
                    <Text style={styles.recentTimestamp}>{mealDisplay.timestamp}</Text>
                    <Text style={styles.recentNote}>{mealDisplay.note}</Text>
                  </View>
                  <View style={styles.recentCaloriesPill}>
                    <Text style={styles.recentCaloriesLabel}>Calories</Text>
                    <Text style={styles.recentCaloriesValue}>{mealDisplay.calories}</Text>
                  </View>
                </View>
                <View style={styles.recentMacroRow}>
                  {mealDisplay.macros.map((macro) => (
                    <View key={macro.label} style={styles.recentMacroPill}>
                      <Text style={styles.recentMacroLabel}>{macro.label}</Text>
                      <Text style={styles.recentMacroValue}>{macro.value}</Text>
                    </View>
                  ))}
                </View>
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
          <Feather name="plus" size={28} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    fontSize: 22,
    color: '#11181C',
    fontWeight: '700',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFECDD',
  },
  streakValue: {
    color: '#FF7A00',
    fontWeight: '600',
  },
  dayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayItem: {
    alignItems: 'center',
    gap: 6,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E1E4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeActive: {
    backgroundColor: '#11181C',
    borderStyle: 'solid',
    borderColor: '#11181C',
  },
  dayBadgeFuture: {
    borderColor: '#E6E7F2',
  },
  dayLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  dayLabelActive: {
    color: '#FFFFFF',
  },
  dayLabelFuture: {
    color: '#D1D5DB',
  },
  dayNumber: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  dayNumberActive: {
    color: '#11181C',
  },
  dayNumberFuture: {
    color: '#D1D5DB',
  },
  calorieCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  calorieCopy: {
    gap: 6,
  },
  calorieValue: {
    fontSize: 42,
    color: '#11181C',
    fontWeight: '700',
  },
  calorieLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  calorieRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    borderColor: '#EFEFF7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calorieRingProgress: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    borderColor: '#11181C',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  calorieRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F9F8FD',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF0FF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  macroBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 20,
    color: '#11181C',
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 12,
    textAlign: 'center',
    color: '#6B7280',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DADDE8',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#11181C',
  },
  recentSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#11181C',
    fontWeight: '600',
  },
  recentCard: {
    backgroundColor: '#F9F8FD',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#ECECF2',
  },
  recentEmptyCard: {
    backgroundColor: '#F9F8FD',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ECECF2',
    gap: 8,
  },
  recentHeadline: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '600',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  recentDetails: {
    flex: 1,
    gap: 6,
    paddingRight: 12,
  },
  recentTimestamp: {
    fontSize: 14,
    color: '#6B7280',
  },
  recentNote: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  recentCaloriesPill: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E7F2',
    minWidth: 110,
    gap: 4,
  },
  recentCaloriesLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentCaloriesValue: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '600',
  },
  recentMacroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recentMacroPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EEF0FF',
    gap: 4,
  },
  recentMacroLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentMacroValue: {
    fontSize: 15,
    color: '#11181C',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#11181C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#11181C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
});
