import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Droplet, Fish, Leaf, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/ui/AppBackground';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Shimmer } from '@/components/ui/Shimmer';
import { useDiaryDate } from '@/hooks/useDiaryDate';
import { getDiaryDates, getLocalDateKey, parseLocalDateKey } from '@/lib/mealDates';
import { resolveImageUri, useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { aggregateDailyNutrition, getMealsForDate } from '@/services/nutritionAggregation';
import { useUserGoalsStore } from '@/store/userGoalsStore';

// ─────────────────────────────────────────────────────────────────────────────
// Design System - Cal AI Minimal Style
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  // Core
  primary: '#0066FF',
  primaryGlow: 'rgba(0, 102, 255, 0.12)',

  // Macros
  protein: '#FF3B30',
  proteinBg: 'rgba(255, 59, 48, 0.08)',
  carbs: '#FF9500',
  carbsBg: 'rgba(255, 149, 0, 0.08)',
  fat: '#007AFF',
  fatBg: 'rgba(0, 122, 255, 0.08)',

  // Surfaces
  cardBg: 'rgba(255, 255, 255, 0.95)',
  cardBorder: 'rgba(0, 0, 0, 0.04)',
  glassBg: 'rgba(255, 255, 255, 0.85)',

  // Text
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#AEAEB2',

  // Accents
  success: '#34C759',
  successBg: 'rgba(52, 199, 89, 0.12)',
  warning: '#FF9500',
  warningBg: 'rgba(255, 149, 0, 0.12)',
};

type MacroKey = 'protein' | 'carbs' | 'fat';

type MacroCardConfig = {
  key: MacroKey;
  label: string;
  Icon: LucideIcon;
  iconColor: string;
  bgColor: string;
};

const MACRO_CONFIGS: MacroCardConfig[] = [
  { key: 'protein', label: 'Protein left', Icon: Fish, iconColor: COLORS.protein, bgColor: COLORS.proteinBg },
  { key: 'carbs', label: 'Carbs left', Icon: Leaf, iconColor: COLORS.carbs, bgColor: COLORS.carbsBg },
  { key: 'fat', label: 'Fat left', Icon: Droplet, iconColor: COLORS.fat, bgColor: COLORS.fatBg },
];

const DAY_PILL_WIDTH = 48;
const DAY_PILL_HEIGHT = 72;
const DAY_PILL_GAP = 8;

type DayItem = {
  date: Date;
  label: string;
  day: string;
  isToday: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDateKey = params.date && parseLocalDateKey(params.date) ? params.date : undefined;
  return <DiaryHome key={initialDateKey ?? 'today'} initialDateKey={initialDateKey} />;
}

function DiaryHome({ initialDateKey }: { initialDateKey?: string }) {
  const session = useSessionStore((state) => state.session);
  const meals = useMealLogStore((state) => state.meals);
  const status = useMealLogStore((state) => state.status);
  const mealError = useMealLogStore((state) => state.error);
  const fetchMeals = useMealLogStore((state) => state.fetchMeals);
  const userId = session?.user?.id ?? null;

  const { todayKey, selectedDateKey, selectDate } = useDiaryDate(initialDateKey);
  const dates = getDiaryDates(todayKey, selectedDateKey).map(date => ({
    date,
    label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).slice(0, 1),
    day: String(date.getDate()),
    isToday: getLocalDateKey(date) === todayKey,
  }));
  const selectedIndex = dates.findIndex(item => getLocalDateKey(item.date) === selectedDateKey);
  const selectedDate = parseLocalDateKey(selectedDateKey)!;
  const selectedDateLabel = selectedDateKey === todayKey ? 'Today' :
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(selectedDate);
  const listRef = useRef<FlatList<DayItem>>(null);

  const dayMeals = getMealsForDate(meals, selectedDate);
  const recentMeals = dayMeals;

  const fetchGoals = useUserGoalsStore((state) => state.fetchGoals);
  const goals = useUserGoalsStore((state) => state.goals);

  const dailyTotals = aggregateDailyNutrition(dayMeals, selectedDate);
  const dailyTargets = goals ? {
    calories: goals.dailyCalories, protein: goals.dailyProteinG,
    carbs: goals.dailyCarbsG, fat: goals.dailyFatG,
  } : null;

  const calorieBalance = dailyTargets ? dailyTargets.calories - dailyTotals.calories : 0;

  const percentageConsumed = dailyTargets && dailyTargets.calories > 0
    ? Math.min(100, Math.round((dailyTotals.calories / dailyTargets.calories) * 100))
    : 0;

  const hasGoalsValue = dailyTargets !== null;

  useEffect(() => {
    if (!userId) return;
    fetchMeals(userId).catch(console.error);
    fetchGoals(userId).catch(console.error);
  }, [userId, fetchMeals, fetchGoals]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToIndex({ index: selectedIndex, animated: true, viewPosition: 0.5 });
  }, [selectedIndex, todayKey]);

  const isInitialLoading = status === 'loading' && meals.length === 0;
  const totalsAvailable = !isInitialLoading && (!mealError || meals.length > 0);
  const calorieDisplay = Math.round(dailyTargets ? Math.abs(calorieBalance) : dailyTotals.calories);

  return (
    <View style={styles.container}>
      <AppBackground />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Animated.View style={styles.root} entering={FadeIn.duration(280)} exiting={FadeOut.duration(200)}>

          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}>

            {/* Header */}
            <Animated.View style={styles.header} entering={FadeInDown.duration(280)}>
              <View style={styles.brandRow}>
                <Text style={styles.brandEmoji}>🍎</Text>
                <Text style={styles.brandText}>Cal AI</Text>
              </View>
            </Animated.View>

            {/* Day Selector */}
            <Animated.View entering={FadeInDown.duration(280).delay(40)} style={styles.dayStripContainer}>
              <View style={styles.dayStripWrapper}>
                <FlatList
                  ref={listRef}
                  data={dates}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.date.toISOString()}
                  contentContainerStyle={styles.dayStrip}
                  renderItem={({ item, index }) => (
                    <DatePill
                      item={item}
                      isSelected={index === selectedIndex}
                      onSelect={() => selectDate(getLocalDateKey(item.date))}
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
            </Animated.View>

            {/* Hero Calorie Card */}
            <Animated.View entering={FadeInDown.duration(280).delay(80)}>
              <Pressable
                style={styles.heroCard}
                onPress={() => !hasGoalsValue && router.push('/(app)/goal-flow' as any)}>
                <LinearGradient
                  colors={['#FFFFFF', '#F5F5F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />


                <View style={styles.heroContent}>
                  <View style={styles.heroCopy}>
                    <View style={styles.heroLabelRow}>
                      <View style={styles.heroDot} />
                      <Text style={styles.heroLabel}>
                        {selectedDateLabel.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.heroValue}>
                      {totalsAvailable ? calorieDisplay.toLocaleString() : '—'}
                    </Text>
                    <Text style={styles.heroSubtext}>
                      {isInitialLoading ? 'Loading your diary...' : !totalsAvailable ? 'Unable to load totals' :
                        dailyTargets ? calorieBalance < 0 ? 'calories over target' : 'calories remaining' : 'calories eaten'}
                    </Text>
                    {totalsAvailable && dailyTargets ? (
                      <Text style={styles.heroSubtext}>
                        {Math.round(dailyTotals.calories)} eaten · {dailyTargets.calories} {selectedDateKey === todayKey ? 'target' : 'current target'}
                      </Text>
                    ) : !dailyTargets && totalsAvailable ? (
                      <Text style={styles.seeAllText}>Set daily targets</Text>
                    ) : null}
                  </View>

                  <View style={styles.ringContainer}>
                    <ProgressRing
                      value={hasGoalsValue ? percentageConsumed : 0}
                      size={100}
                      strokeWidth={10}
                      gradientColors={[COLORS.success, '#30D158']}
                      backgroundColor="rgba(0,0,0,0.05)">
                      <View style={styles.ringInner}>
                        <Text style={styles.ringPercent}>
                          {totalsAvailable && hasGoalsValue ? `${percentageConsumed}%` : '—'}
                        </Text>
                        <Text style={styles.ringLabel}>eaten</Text>
                      </View>
                    </ProgressRing>
                  </View>
                </View>
              </Pressable>
            </Animated.View>



            {/* Macro Cards */}
            {/* Macro Cards */}
            <Animated.View entering={FadeInDown.duration(280).delay(140)} style={styles.macroSection}>
              {/* <Text style={styles.sectionLabel}>MACROS</Text> */}
              <View style={styles.macroRow}>
                {MACRO_CONFIGS.map((config, index) => {
                  const consumed = dailyTotals[config.key];
                  const balance = dailyTargets ? dailyTargets[config.key] - consumed : consumed;
                  const label = `${config.key.charAt(0).toUpperCase() + config.key.slice(1)} ${dailyTargets ? balance < 0 ? 'over' : 'left' : 'eaten'}`;

                  return (
                    <Animated.View
                      key={config.key}
                      entering={FadeInDown.delay(180 + index * 60).duration(260)}
                      style={styles.macroCard}>

                      <View style={styles.macroContentTop}>
                        <Text style={styles.macroValue}>{totalsAvailable ? `${Math.round(Math.abs(balance))}g` : '—'}</Text>
                        <Text style={styles.macroLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
                        {totalsAvailable && dailyTargets ? <Text style={styles.macroIntake}>{Math.round(consumed)}g eaten</Text> : null}
                      </View>

                      <View style={styles.macroRingContainer}>
                        <View style={[styles.macroRing, { borderColor: config.bgColor }]}>
                          <config.Icon size={28} color={config.iconColor} fill={config.iconColor} />
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Pagination Dots (Visual Only) */}
              <View style={styles.paginationDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </Animated.View>

            {/* Recent Meals */}
            <Animated.View entering={FadeInDown.duration(280).delay(240)} style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Meals · {selectedDateLabel}</Text>
                {meals.length > 0 && (
                  <Pressable onPress={() => router.push('/(app)/meal-history')}>
                    <Text style={styles.seeAllText}>History</Text>
                  </Pressable>
                )}
              </View>

              {isInitialLoading ? (
                <View style={styles.emptyCard}>
                  <ActivityIndicator size="small" color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Loading your meals...</Text>
                </View>
              ) : mealError ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="alert-circle-outline" size={24} color={COLORS.textTertiary} />
                  <Text style={styles.emptyText}>{mealError}</Text>
                  <Pressable accessibilityRole="button" onPress={() => userId && fetchMeals(userId).catch(console.error)}>
                    <Text style={styles.seeAllText}>Retry loading meals</Text>
                  </Pressable>
                </View>
              ) : recentMeals.length > 0 ? (
                <View style={styles.mealsList}>
                  {recentMeals.map((meal, index) => {
                    const imageUri = resolveImageUri(meal.imageUri, meal.imageUrl);
                    return (
                      <Animated.View
                        key={meal.id}
                        entering={FadeInDown.delay(280 + index * 60).duration(260)}
                        style={styles.mealCard}>
                        <MealImage uri={imageUri} />
                        <View style={styles.mealContent}>
                          <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                          <Text style={styles.mealTime}>{formatMealTimestamp(meal.timestamp)}</Text>
                          <View style={styles.mealMacros}>
                            <Text style={styles.mealMacroItem}>🔥 {Math.round(meal.calories)}</Text>
                            <Text style={styles.mealMacroItem}>P: {Math.round(meal.macros.protein)}g</Text>
                            <Text style={styles.mealMacroItem}>C: {Math.round(meal.macros.carbs)}g</Text>
                            <Text style={styles.mealMacroItem}>F: {Math.round(meal.macros.fat)}g</Text>
                          </View>
                        </View>
                        <Pressable style={styles.mealMoreBtn}>
                          <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textTertiary} />
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>📸</Text>
                  <Text style={styles.emptyTitle}>No meals for {selectedDateLabel.toLowerCase()}</Text>
                  <Text style={styles.emptyText}>Log a meal for this day to get started</Text>
                </View>
              )}
            </Animated.View>
          </Animated.ScrollView>

          {/* Floating Action Button */}
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Add a new meal"
            style={styles.fab}
            onPress={() => router.push({ pathname: '/(app)/camera', params: { date: selectedDateKey } })}>
            <Ionicons name="camera" size={22} color="#FFFFFF" />
            <Text style={styles.fabLabel}>Log meal</Text>
          </AnimatedPressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DatePill({
  item,
  isSelected,
  onSelect,
}: {
  item: DayItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <View style={styles.dayPillWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        accessibilityState={{ selected: isSelected }}
        onPress={onSelect}
        style={[styles.dayPill, isSelected && styles.dayPillActive]}>
        <Text style={[styles.dayPillLabel, isSelected && styles.dayPillLabelActive]}>
          {item.label}
        </Text>
        <Text style={[styles.dayPillNumber, isSelected && styles.dayPillNumberActive]}>
          {item.day}
        </Text>
        {item.isToday && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
      </Pressable>
    </View>
  );
}

function MealImage({ uri }: { uri?: string | null }) {
  const [loaded, setLoaded] = useState(false);

  if (!uri) {
    return (
      <View style={styles.mealImagePlaceholder}>
        <Text style={styles.mealImageEmoji}>🍽️</Text>
      </View>
    );
  }

  return (
    <View style={styles.mealImageWrapper}>
      {!loaded && <Shimmer style={styles.mealImage} />}
      <Image
        source={{ uri }}
        style={[styles.mealImage, !loaded && styles.imageHidden]}
        onLoadEnd={() => setLoaded(true)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatMealTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  return `${isToday ? 'Today' : dayFormatter.format(date)} • ${timeFormatter.format(date)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Set the base white background here
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandEmoji: {
    fontSize: 28,
  },
  brandText: {
    fontSize: 26,
    fontFamily: 'Manrope_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.warningBg,
  },
  streakText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.warning,
  },

  // Day Strip
  dayStripContainer: {
    marginBottom: 20,
  },
  dayStripWrapper: {
    position: 'relative',
  },
  dayStrip: {
    paddingVertical: 4,
  },
  dayPillHighlight: {
    position: 'absolute',
    top: 4,
    height: DAY_PILL_HEIGHT,
    borderRadius: 16,
    backgroundColor: COLORS.primaryGlow,
  },
  dayPillWrapper: {
    width: DAY_PILL_WIDTH,
    height: DAY_PILL_HEIGHT,
    marginRight: DAY_PILL_GAP,
  },
  dayPill: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  dayPillActive: {
    backgroundColor: '#1C1C1E',
    borderColor: 'transparent',
  },
  dayPillLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayPillLabelActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  dayPillNumber: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  dayPillNumberActive: {
    color: '#FFFFFF',
  },
  todayDot: {
    marginTop: 6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
  },
  todayDotActive: {
    backgroundColor: '#FFFFFF',
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  heroAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.primary,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 28,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  heroValue: {
    fontSize: 48,
    fontFamily: 'Manrope_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  heroSubtext: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
  },
  ringLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textSecondary,
    marginTop: 2,
  },


  // Macros
  macroSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  macroCard: {
    flex: 1,
    height: 180,
    padding: 16,
    borderRadius: 24,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    justifyContent: 'space-between',
  },
  macroContentTop: {
    alignItems: 'flex-start',
  },
  macroValue: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
    letterSpacing: -1,
    marginBottom: 4,
    lineHeight: 36,
  },
  macroLabel: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textPrimary,
  },
  macroIntake: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.textSecondary,
  },
  macroRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  dotActive: {
    backgroundColor: '#1C1C1E',
  },

  // Recent Section
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
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.primary,
  },
  mealsList: {
    gap: 12,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 126,
    padding: 12,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mealImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 18,
    overflow: 'hidden',
  },
  mealImage: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  imageHidden: {
    opacity: 0,
  },
  mealImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealImageEmoji: {
    fontSize: 32,
  },
  mealContent: {
    flex: 1,
    marginLeft: 14,
  },
  mealName: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textPrimary,
  },
  mealTime: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  mealMacroItem: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textSecondary,
  },
  mealMoreBtn: {
    padding: 8,
  },

  // Empty State
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: '#1C1C1E',
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  fabLabel: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});
