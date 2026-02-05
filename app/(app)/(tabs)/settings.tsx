import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVITY_LEVEL_LABELS, ACTIVITY_LEVEL_SUBTITLES } from '@/app/constants/settings';
import type { Units } from '@/app/types/settings';
import { SettingsPicker } from '@/components/settings/SettingsPicker';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsToggle } from '@/components/settings/SettingsToggle';
import { SexActivityModal } from '@/components/SexActivityModal';
import { AppBackground } from '@/components/ui/AppBackground';
import { WeightEntryModal } from '@/components/WeightEntryModal';
import { useSessionStore } from '@/lib/session-store';
import { supabase } from '@/lib/supabase';
import { calculateAge, type ActivityLevel, type Sex } from '@/lib/user-goals-types';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { patchUserGoals } from '@/services/userGoals';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

// ─────────────────────────────────────────────────────────────────────────────
// Design Constants
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  // Accent palette
  accent: '#0A84FF', // Vibrant blue
  accentGlow: 'rgba(10, 132, 255, 0.15)',
  accentGlowStrong: 'rgba(10, 132, 255, 0.25)',

  // Warm accents for metrics
  warmAccent: '#FF6B35', // Coral/orange for energy
  warmGlow: 'rgba(255, 107, 53, 0.12)',

  // Success/positive
  success: '#32D74B',
  successGlow: 'rgba(50, 215, 75, 0.12)',

  // Surfaces
  cardBg: 'rgba(255, 255, 255, 0.85)',
  cardBorder: 'rgba(0, 0, 0, 0.04)',
  glassCard: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',

  // Text
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#AEAEB2',

  // Backgrounds  
  pageBg: '#FFFFFF',
  surfaceLight: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [personalDetailsModalMode, setPersonalDetailsModalMode] = useState<null | 'activity'>(null);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [units, setUnits] = useState<Units>('metric');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [theme, setTheme] = useState<'System' | 'Light' | 'Dark'>('System');
  const { session } = useSessionStore();
  const { goals, fetchGoals, isLoading: goalsLoading, error: goalsError, getDailyTargets } = useUserGoalsStore();
  const { latest: latestWeight, fetchLatest, addToday, error: weightError } = useUserWeightLogStore();

  useEffect(() => {
    if (session?.user?.id) {
      fetchGoals(session.user.id);
      fetchLatest(session.user.id);
    }
  }, [session?.user?.id, fetchGoals, fetchLatest]);

  const handleAdjustGoals = () => {
    router.push('/(app)/goal-flow' as any);
  };

  const dailyTargets = getDailyTargets();
  const hasGoals = !!goals;

  const profileName = useMemo(() => {
    const maybeMetadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
    const name = maybeMetadata?.full_name ?? maybeMetadata?.name;
    return typeof name === 'string' && name.trim().length > 0 ? name : 'Profile';
  }, [session?.user?.user_metadata]);

  const profileEmail = session?.user?.email ?? 'Not signed in';
  const profileSex = goals?.sex ? (goals.sex === 'male' ? 'Male' : 'Female') : null;
  const profileAge = goals?.birthdate ? calculateAge(goals.birthdate) : null;
  const profileHeightCm = goals?.heightCm ?? null;
  const currentWeightKg = latestWeight?.weightKg ?? goals?.weightKg ?? null;

  const formatWeightKg = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
  };
  const weightLabel = currentWeightKg == null ? 'Not set' : formatWeightKg(currentWeightKg);

  const handleSaveSexActivity = async (next: { sex: Sex; activityLevel: ActivityLevel }) => {
    if (!session?.user?.id) return;

    if (!goals) {
      Alert.alert('Set up required', 'Please complete goal setup first.');
      handleAdjustGoals();
      return;
    }

    const weightKgForCalc = goals.weightKg;
    const heightCmForCalc = goals.heightCm;

    if (weightKgForCalc == null || heightCmForCalc == null) {
      Alert.alert('Missing data', 'Please complete goal setup first.');
      handleAdjustGoals();
      return;
    }

    const plan = calculateNutritionPlan(
      weightKgForCalc,
      heightCmForCalc,
      calculateAge(goals.birthdate),
      goals.goalType,
      goals.targetWeightKg,
      next.sex,
      next.activityLevel
    );

    const { data, error } = await patchUserGoals(session.user.id, {
      sex: next.sex,
      activity_level: next.activityLevel,
      weight_kg: weightKgForCalc,
      daily_calories: plan.dailyCalories,
      daily_protein_g: plan.dailyProtein,
      daily_carbs_g: plan.dailyCarbs,
      daily_fat_g: plan.dailyFat,
    });

    if (error || !data) {
      Alert.alert('Update failed', error ?? 'Unable to update your details.');
      return;
    }

    useUserGoalsStore.setState({ goals: data, error: null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      /* no-op */
    });
  };

  const handleSaveWeight = async (weightKg: number) => {
    if (!session?.user?.id) return;

    if (!goals) {
      Alert.alert('Set up required', 'Please complete goal setup first.');
      handleAdjustGoals();
      return;
    }

    const heightCmForCalc = goals.heightCm;
    const birthdateForCalc = goals.birthdate;
    const targetWeightKgForCalc = goals.targetWeightKg;
    const goalTypeForCalc = goals.goalType;
    const sexForCalc = goals.sex;
    const activityLevelForCalc = goals.activityLevel;

    if (
      heightCmForCalc == null ||
      !birthdateForCalc ||
      targetWeightKgForCalc == null ||
      !goalTypeForCalc ||
      !sexForCalc ||
      !activityLevelForCalc
    ) {
      Alert.alert('Missing data', 'Please complete goal setup first.');
      handleAdjustGoals();
      return;
    }

    const saved = await addToday(session.user.id, weightKg);
    if (!saved) {
      Alert.alert('Update failed', weightError ?? 'Unable to save your weight.');
      return;
    }

    const plan = calculateNutritionPlan(
      weightKg,
      heightCmForCalc,
      calculateAge(birthdateForCalc),
      goalTypeForCalc,
      targetWeightKgForCalc,
      sexForCalc,
      activityLevelForCalc
    );

    const { data, error } = await patchUserGoals(session.user.id, {
      weight_kg: weightKg,
      daily_calories: plan.dailyCalories,
      daily_protein_g: plan.dailyProtein,
      daily_carbs_g: plan.dailyCarbs,
      daily_fat_g: plan.dailyFat,
    });

    if (error || !data) {
      Alert.alert('Update failed', error ?? 'Unable to update your targets.');
      return;
    }

    useUserGoalsStore.setState({ goals: data, error: null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      /* no-op */
    });
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'You will need to sign in again to access your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            Alert.alert('Log out failed', error.message);
          }
        },
      },
    ]);
  };

  const dailyCalories = dailyTargets?.calories ?? goals?.dailyCalories ?? null;
  const activityValue = goals?.activityLevel ? ACTIVITY_LEVEL_LABELS[goals.activityLevel] : 'Not set';
  const userInitials = useMemo(() => {
    const parts = profileName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return profileName.slice(0, 2).toUpperCase();
  }, [profileName]);

  // Metrics for profile card
  const metricsText =
    typeof profileHeightCm === 'number' && profileSex && typeof profileAge === 'number'
      ? `${Math.round(profileHeightCm)}cm • ${profileSex} • ${Math.round(profileAge)}y`
      : null;

  function formatNumber(value: number): string {
    try {
      return new Intl.NumberFormat('en-US').format(value);
    } catch {
      return String(value);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Minimal Background - Cal AI style */}
      {/* Minimal Background - Cal AI style */}
      <AppBackground />

      <Animated.View style={styles.screen} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>

          {/* Hero Header */}
          <Animated.View entering={FadeInDown.duration(280)} style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Settings</Text>
            <Text style={styles.heroSubtitle}>
              Personalize your experience and manage your plan
            </Text>
          </Animated.View>

          {/* Profile Card - Glassmorphism */}
          <Animated.View entering={FadeInDown.duration(280).delay(60)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile and body metrics"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                router.push('/(app)/settings/body-metrics' as any);
              }}
              style={({ pressed }) => [
                styles.profileCard,
                pressed && styles.profileCardPressed,
              ]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.75)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.profileContent}>
                {/* Avatar with gradient */}
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={[COLORS.accent, '#5856D6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                  />
                  <Text style={styles.avatarText}>{userInitials}</Text>
                </View>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {goalsLoading ? 'Loading…' : profileName}
                  </Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {goalsLoading ? 'Loading…' : profileEmail}
                  </Text>
                  {metricsText && (
                    <View style={styles.metricsRow}>
                      <View style={styles.metricBadge}>
                        <Text style={styles.metricBadgeText}>{metricsText}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
              </View>
            </Pressable>
          </Animated.View>

          {/* Loading/Error States */}
          {goalsLoading && (
            <Animated.View entering={FadeInDown.duration(220).delay(90)}>
              <Text style={styles.syncing}>Syncing your data…</Text>
            </Animated.View>
          )}

          {goalsError && (
            <Animated.View entering={FadeInDown.duration(220).delay(120)} style={styles.errorBanner}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={18} color="#FF453A" />
              </View>
              <Text style={styles.errorText}>{goalsError}</Text>
            </Animated.View>
          )}

          {/* Daily Target Hero Card */}
          <Animated.View entering={FadeInDown.duration(280).delay(140)} style={styles.heroCardContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Daily target ${dailyCalories ?? 'not set'} calories per day, tap to adjust`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                handleAdjustGoals();
              }}
              style={({ pressed }) => [
                styles.heroCard,
                pressed && styles.heroCardPressed,
              ]}>
              <LinearGradient
                colors={['#FFFFFF', '#F5F5F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.heroCardContent}>
                <View style={styles.heroCardHeader}>
                  <View style={styles.heroCardLabelRow}>
                    <View style={styles.heroCardDot} />
                    <Text style={styles.heroCardLabel}>DAILY TARGET</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                </View>

                <View style={styles.heroCardMetric}>
                  <Text style={styles.heroCardValue}>
                    {typeof dailyCalories === 'number' ? formatNumber(dailyCalories) : '—'}
                  </Text>
                  <Text style={styles.heroCardUnit}>calories/day</Text>
                </View>

                <View style={styles.heroCardHint}>
                  <Ionicons name="sparkles" size={14} color={COLORS.accent} />
                  <Text style={styles.heroCardHintText}>Personalized for your goals</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View entering={FadeInDown.duration(280).delay(180)} style={styles.quickActionsContainer}>
            <QuickActionButton
              icon="sparkles-outline"
              label="Adjust Goals"
              color={COLORS.accent}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                handleAdjustGoals();
              }}
            />
            <View style={styles.quickActionSpacer} />
            <QuickActionButton
              icon="scale-outline"
              label="Log Weight"
              color={COLORS.success}
              onPress={() => {
                if (!hasGoals) {
                  handleAdjustGoals();
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setWeightModalVisible(true);
              }}
            />
          </Animated.View>

          {/* Targets Section */}
          <Animated.View entering={FadeInDown.duration(280).delay(220)} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Targets</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <SettingsSection isFirst>
              <SettingsRow
                icon="barbell-outline"
                label="Current Weight"
                value={weightLabel}
                subtitle="Tap to update today's weight"
                onPress={() => (hasGoals ? setWeightModalVisible(true) : handleAdjustGoals())}
              />
              <SettingsRow
                icon="walk-outline"
                label="Activity Level"
                value={activityValue}
                subtitle={goals?.activityLevel ? ACTIVITY_LEVEL_SUBTITLES[goals.activityLevel] : undefined}
                onPress={() => (hasGoals ? setPersonalDetailsModalMode('activity') : handleAdjustGoals())}
                isLast
              />
            </SettingsSection>
          </Animated.View>

          {/* Preferences Section */}
          <Animated.View entering={FadeInDown.duration(280).delay(260)} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Preferences</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <SettingsSection isFirst>
              <SettingsPicker
                icon="swap-horizontal"
                label="Units"
                value={units === 'metric' ? 'Metric' : 'Imperial'}
                options={['Metric', 'Imperial']}
                onSelect={(next) => setUnits(next === 'Imperial' ? 'imperial' : 'metric')}
              />
              <SettingsToggle
                icon="alarm-outline"
                label="Reminders"
                subtitle="Set meal reminders"
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
              />
              <SettingsPicker
                icon="color-palette-outline"
                label="Theme"
                value={theme}
                options={['System', 'Light', 'Dark']}
                onSelect={(next) => setTheme(next as typeof theme)}
                isLast
              />
            </SettingsSection>
          </Animated.View>

          {/* Account Section */}
          <Animated.View entering={FadeInDown.duration(280).delay(300)} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <SettingsSection isFirst>
              <SettingsRow
                icon="star-outline"
                label="Subscription"
                value="Free"
                onPress={() => Alert.alert('Subscription', 'Subscription management is not wired up yet.')}
              />
              <SettingsRow
                icon="download-outline"
                label="Data Export"
                onPress={() => Alert.alert('Data Export', 'Export is not available yet.')}
              />
              <SettingsRow
                icon="help-circle-outline"
                label="Help & Support"
                onPress={() => Alert.alert('Help & Support', 'Support is not available yet.')}
                isLast
              />
            </SettingsSection>

            {/* Logout Button */}
            <Pressable
              accessibilityRole="button"
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.logoutButtonPressed,
              ]}>
              <Ionicons name="log-out-outline" size={18} color="#FF453A" />
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </Animated.View>

          {/* App Info Footer */}
          <Animated.View entering={FadeInDown.duration(280).delay(340)} style={styles.footer}>
            <Text style={styles.footerText}>Cal AI • Version 1.0.0</Text>
            <Text style={styles.footerSubtext}>Made with ❤️ for your health</Text>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>

      <SexActivityModal
        visible={personalDetailsModalMode != null}
        mode="activity"
        sex={(goals?.sex ?? 'male') as Sex}
        activityLevel={goals?.activityLevel ?? 'sedentary'}
        onClose={() => setPersonalDetailsModalMode(null)}
        onSave={handleSaveSexActivity}
      />

      <WeightEntryModal
        visible={weightModalVisible}
        initialWeightKg={currentWeightKg}
        onClose={() => setWeightModalVisible(false)}
        onSave={handleSaveWeight}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Action Button Component
// ─────────────────────────────────────────────────────────────────────────────

type QuickActionButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
};

function QuickActionButton({ icon, label, color, onPress }: QuickActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.quickActionPressed,
      ]}>
      <View style={[styles.quickActionIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },

  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Hero Header
  heroHeader: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  heroTitle: {
    fontSize: 34,
    letterSpacing: -0.8,
    color: COLORS.textPrimary,
    fontFamily: 'Manrope_800ExtraBold',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
    fontFamily: 'Manrope_400Regular',
  },

  // Profile Card
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  profileCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  profileInfo: {
    flex: 1,
    paddingRight: 8,
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.textSecondary,
  },
  metricsRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  metricBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  metricBadgeText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.textSecondary,
  },

  // Loading/Error
  syncing: {
    marginHorizontal: 24,
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textTertiary,
    fontFamily: 'Manrope_500Medium',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF453A',
    lineHeight: 20,
    fontFamily: 'Manrope_500Medium',
  },

  // Hero Card (Daily Target)
  heroCardContainer: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  heroCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  heroCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.accent,
  },
  heroCardContent: {
    padding: 24,
    paddingTop: 28,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginRight: 10,
  },
  heroCardLabel: {
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLORS.textSecondary,
    fontFamily: 'Manrope_600SemiBold',
  },
  heroCardMetric: {
    alignItems: 'flex-start',
  },
  heroCardValue: {
    fontSize: 52,
    letterSpacing: -2,
    color: COLORS.textPrimary,
    fontFamily: 'Manrope_800ExtraBold',
    lineHeight: 56,
  },
  heroCardUnit: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontFamily: 'Manrope_500Medium',
  },
  heroCardHint: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCardHintText: {
    marginLeft: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Manrope_500Medium',
  },

  // Quick Actions
  quickActionsContainer: {
    marginTop: 16,
    marginHorizontal: 20,
    flexDirection: 'row',
  },
  quickActionSpacer: {
    width: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionPressed: {
    backgroundColor: '#F8F8F8',
    transform: [{ scale: 0.99 }],
  },
  quickActionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickActionLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: COLORS.textPrimary,
  },

  // Sections
  sectionContainer: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.textTertiary,
    fontFamily: 'Manrope_600SemiBold',
  },
  sectionTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: 12,
  },

  // Logout
  logoutButton: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FF453A',
  },

  // Footer
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontFamily: 'Manrope_500Medium',
  },
  footerSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'Manrope_400Regular',
    opacity: 0.7,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 24,
  },
});
