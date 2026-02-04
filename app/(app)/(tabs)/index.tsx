import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Droplet, Fish, Leaf, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/ui/AppBackground';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Shimmer } from '@/components/ui/Shimmer';
import { resolveImageUri, useMealLogStore } from '@/lib/meal-log-store';
import { useSessionStore } from '@/lib/session-store';
import { aggregateDailyNutrition } from '@/services/nutritionAggregation';
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
  { key: 'protein', label: 'Protein', Icon: Fish, iconColor: COLORS.protein, bgColor: COLORS.proteinBg },
  { key: 'carbs', label: 'Carbs', Icon: Leaf, iconColor: COLORS.carbs, bgColor: COLORS.carbsBg },
  { key: 'fat', label: 'Fat', Icon: Droplet, iconColor: COLORS.fat, bgColor: COLORS.fatBg },
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

  const recentMeals = meals.slice(0, 2);

  const fetchGoals = useUserGoalsStore((state) => state.fetchGoals);
  const hasGoals = useUserGoalsStore((state) => state.hasGoals);
  const getDailyTargets = useUserGoalsStore((state) => state.getDailyTargets);

  const dailyTotals = aggregateDailyNutrition(meals);
  const dailyTargets = getDailyTargets();

  const caloriesRemaining = dailyTargets ? Math.max(0, dailyTargets.calories - dailyTotals.calories) : 0;
  const proteinRemaining = dailyTargets ? Math.max(0, dailyTargets.protein - dailyTotals.protein) : 0;
  const carbsRemaining = dailyTargets ? Math.max(0, dailyTargets.carbs - dailyTotals.carbs) : 0;
  const fatRemaining = dailyTargets ? Math.max(0, dailyTargets.fat - dailyTotals.fat) : 0;

  const percentageConsumed = dailyTargets && dailyTargets.calories > 0
    ? Math.min(100, Math.round((dailyTotals.calories / dailyTargets.calories) * 100))
    : 0;

  const macroProgress = {
    protein: dailyTargets && dailyTargets.protein > 0 ? Math.min(1, dailyTotals.protein / dailyTargets.protein) : 0,
    carbs: dailyTargets && dailyTargets.carbs > 0 ? Math.min(1, dailyTotals.carbs / dailyTargets.carbs) : 0,
    fat: dailyTargets && dailyTargets.fat > 0 ? Math.min(1, dailyTotals.fat / dailyTargets.fat) : 0,
  };

  const hasGoalsValue = hasGoals();
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
    transform: [{ scale: fabBaseScale.value * fabPressScale.value }],
  }));

  useEffect(() => {
    if (!userId) return;
    fetchMeals(userId).catch(console.error);
    fetchGoals(userId).catch(console.error);
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
              <Pressable style={styles.streakBadge}>
                <Ionicons name="flame" size={16} color={COLORS.warning} />
                <Text style={styles.streakText}>0</Text>
              </Pressable>
            </Animated.View>

            {/* Day Selector */}
            <Animated.View entering={FadeInDown.duration(280).delay(40)} style={styles.dayStripContainer}>
              <View style={styles.dayStripWrapper}>
                <Animated.View pointerEvents="none" style={[styles.dayPillHighlight, highlightStyle]} />
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
                      index={index}
                      isSelected={index === selectedIndex}
                      onSelect={setSelectedIndex}
                      onLayoutItem={(layout) => {
                        dayLayouts.current[index] = layout;
                        if (index === selectedIndex) updateHighlight(index);
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
            </Animated.View>

            {/* Hero Calorie Card */}
            <Animated.View entering={FadeInDown.duration(280).delay(80)}>
              <Pressable
                style={styles.heroCard}
                onPress={() => !hasGoalsValue && router.push('/(app)/goal-flow' as any)}>
                <LinearGradient
                  colors={['#1C1C1E', '#2C2C2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Accent line */}
                <View style={styles.heroAccentLine} />

                <View style={styles.heroContent}>
                  <View style={styles.heroCopy}>
                    <View style={styles.heroLabelRow}>
                      <View style={styles.heroDot} />
                      <Text style={styles.heroLabel}>
                        {hasGoalsValue ? 'TODAY' : 'GET STARTED'}
                      </Text>
                    </View>
                    <Text style={styles.heroValue}>
                      {hasGoalsValue ? calorieDisplay.toLocaleString() : 'Set Goals'}
                    </Text>
                    <Text style={styles.heroSubtext}>
                      {hasGoalsValue ? 'calories remaining' : 'Tap to configure your targets'}
                    </Text>
                  </View>

                  <View style={styles.ringContainer}>
                    <ProgressRing
                      value={hasGoalsValue ? percentageConsumed : 0}
                      size={100}
                      strokeWidth={10}
                      gradientColors={[COLORS.success, '#30D158']}
                      backgroundColor="rgba(255,255,255,0.15)">
                      <View style={styles.ringInner}>
                        <Text style={styles.ringPercent}>
                          {hasGoalsValue ? `${percentageConsumed}%` : '—'}
                        </Text>
                        <Text style={styles.ringLabel}>eaten</Text>
                      </View>
                    </ProgressRing>
                  </View>
                </View>
              </Pressable>
            </Animated.View>



            {/* Macro Cards */}
            <Animated.View entering={FadeInDown.duration(280).delay(140)} style={styles.macroSection}>
              <Text style={styles.sectionLabel}>MACROS</Text>
              <View style={styles.macroRow}>
                {MACRO_CONFIGS.map((config, index) => {
                  let remaining = 0;
                  let progress = 0;
                  if (hasGoalsValue) {
                    if (config.key === 'protein') {
                      remaining = proteinRemaining;
                      progress = macroProgress.protein;
                    } else if (config.key === 'carbs') {
                      remaining = carbsRemaining;
                      progress = macroProgress.carbs;
                    } else {
                      remaining = fatRemaining;
                      progress = macroProgress.fat;
                    }
                  }

                  return (
                    <Animated.View
                      key={config.key}
                      entering={FadeInDown.delay(180 + index * 60).duration(260)}
                      style={styles.macroCard}>
                      <View style={[styles.macroIconBg, { backgroundColor: config.bgColor }]}>
                        <config.Icon size={18} color={config.iconColor} />
                      </View>
                      <Text style={styles.macroValue}>{Math.round(remaining)}g</Text>
                      <Text style={styles.macroLabel}>{config.label}</Text>
                      {/* Progress bar */}
                      <View style={styles.macroProgressBg}>
                        <View
                          style={[
                            styles.macroProgressFill,
                            { width: `${Math.min(100, progress * 100)}%`, backgroundColor: config.iconColor },
                          ]}
                        />
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Recent Meals */}
            <Animated.View entering={FadeInDown.duration(280).delay(240)} style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recently Logged</Text>
                {meals.length > 0 && (
                  <Pressable onPress={() => router.push('/(app)/meal-history')}>
                    <Text style={styles.seeAllText}>See all</Text>
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
                  <Text style={styles.emptyTitle}>No meals logged yet</Text>
                  <Text style={styles.emptyText}>Snap a photo of your meal to get started</Text>
                </View>
              )}
            </Animated.View>
          </Animated.ScrollView>

          {/* Floating Action Button */}
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Add a new meal"
            style={[styles.fab, fabAnimatedStyle]}
            onPress={() => router.push('/(app)/camera')}
            onPressIn={() => { fabPressScale.value = withSpring(0.95, { damping: 16, stiffness: 180 }); }}
            onPressOut={() => { fabPressScale.value = withSpring(1, { damping: 16, stiffness: 180 }); }}>
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
      onLayout={(e) => onLayoutItem(e.nativeEvent.layout)}>
      <Pressable
        onPress={() => onSelect(index)}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 16, stiffness: 180 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 180 }); }}
        style={[styles.dayPill, isSelected && styles.dayPillActive]}>
        <Text style={[styles.dayPillLabel, isSelected && styles.dayPillLabelActive]}>
          {item.label}
        </Text>
        <Text style={[styles.dayPillNumber, isSelected && styles.dayPillNumberActive]}>
          {item.day}
        </Text>
        {item.isToday && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
      </Pressable>
    </Animated.View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
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
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  heroValue: {
    fontSize: 48,
    fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 52,
  },
  heroSubtext: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(255,255,255,0.5)',
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
    color: '#FFFFFF',
  },
  ringLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(255,255,255,0.5)',
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
  },
  macroCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  macroIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  macroValue: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  macroLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  macroProgressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 2,
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
    padding: 12,
    borderRadius: 16,
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
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
  },
  mealImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  imageHidden: {
    opacity: 0,
  },
  mealImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealImageEmoji: {
    fontSize: 22,
  },
  mealContent: {
    flex: 1,
    marginLeft: 12,
  },
  mealName: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textPrimary,
  },
  mealTime: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  mealMacroItem: {
    fontSize: 12,
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
