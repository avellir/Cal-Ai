import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ACTIVITY_LEVEL_LABELS, ACTIVITY_LEVEL_SUBTITLES } from '@/app/constants/settings';
import type { Units } from '@/app/types/settings';
import { DesignColors } from '@/constants/theme';
import { SexActivityModal } from '@/components/SexActivityModal';
import { HeroMetric } from '@/components/settings/HeroMetric';
import { ProfileHeader } from '@/components/settings/ProfileHeader';
import { SettingsPicker } from '@/components/settings/SettingsPicker';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsToggle } from '@/components/settings/SettingsToggle';
import { WeightEntryModal } from '@/components/WeightEntryModal';
import { useSessionStore } from '@/lib/session-store';
import { supabase } from '@/lib/supabase';
import { calculateAge, type ActivityLevel, type Sex } from '@/lib/user-goals-types';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { patchUserGoals } from '@/services/userGoals';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Animated.View style={styles.screen} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <ProfileHeader
            email={profileEmail}
            name={profileName}
            heightCm={profileHeightCm}
            sex={profileSex}
            age={profileAge}
            loading={goalsLoading}
            onPress={() => router.push('/(app)/settings/body-metrics' as any)}
          />

        {goalsLoading ? <Text style={styles.syncing}>Syncing…</Text> : null}

        {goalsError ? (
          <View style={styles.banner}>
            <Ionicons name="alert-circle" size={18} color={DesignColors.warningDark} />
            <Text style={styles.bannerText}>{goalsError}</Text>
          </View>
        ) : null}

        <HeroMetric
          label="Daily Target"
          value={dailyCalories}
          unit="calories/day"
          onPress={handleAdjustGoals}
        />

        <SettingsSection title="Targets">
          <SettingsRow
            icon="barbell-outline"
            label="Current Weight"
            value={weightLabel}
            subtitle="Tap to update today’s weight"
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

        <SettingsSection title="Preferences">
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

        <SettingsSection title="Account">
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
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutRow, pressed ? styles.logoutRowPressed : null]}>
            <View style={styles.logoutIconSpacer} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </SettingsSection>

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DesignColors.iosGroupedBackground,
  },
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: DesignColors.iosGroupedBackground,
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DesignColors.warningBorder,
    backgroundColor: DesignColors.warningBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: DesignColors.warningDark,
    lineHeight: 18,
  },
  syncing: {
    marginHorizontal: 16,
    marginTop: 4,
    fontSize: 13,
    color: DesignColors.iosSecondaryLabel,
  },
  logoutRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutRowPressed: {
    backgroundColor: '#F2F2F7',
  },
  logoutIconSpacer: {
    width: 29,
    marginRight: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: DesignColors.iosDestructive,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 24,
  },
});
