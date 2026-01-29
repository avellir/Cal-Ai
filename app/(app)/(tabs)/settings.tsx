import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesignColors } from '@/constants/theme';
import { SexActivityModal } from '@/components/SexActivityModal';
import { WeightEntryModal } from '@/components/WeightEntryModal';
import { ThemedText } from '@/components/themed-text';
import { AppBackground } from '@/components/ui/AppBackground';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { useSessionStore } from '@/lib/session-store';
import { calculateAge, type ActivityLevel, type Sex } from '@/lib/user-goals-types';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { patchUserGoals } from '@/services/userGoals';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

export default function SettingsScreen() {
  const [sexActivityModalVisible, setSexActivityModalVisible] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const { session } = useSessionStore();
  const { goals, fetchGoals, isLoading: goalsLoading, error: goalsError, getDailyTargets } = useUserGoalsStore();
  const { latest, fetchLatest, addToday, isLoading: weightLoading } = useUserWeightLogStore();

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

  const getSexLabel = (sex: Sex | null) => {
    if (!sex) return 'Not set';
    return sex === 'male' ? 'Male' : 'Female';
  };

  const getActivityLabel = (level: ActivityLevel | null) => {
    if (!level) return 'Not set';
    switch (level) {
      case 'sedentary':
        return 'Sedentary';
      case 'light':
        return 'Lightly active';
      case 'moderate':
        return 'Moderately active';
      case 'active':
        return 'Active';
      case 'veryActive':
        return 'Very active';
      default:
        return 'Not set';
    }
  };

  const birthdateLabel = goals?.birthdate
    ? new Date(goals.birthdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not set';
  const ageLabel = goals?.birthdate ? `${calculateAge(goals.birthdate)} yrs` : 'Not set';

  const displayedWeightKg = latest?.weightKg ?? goals?.weightKg ?? null;
  const weightLabel = displayedWeightKg != null ? `${Math.round(displayedWeightKg * 10) / 10} kg` : 'Not set';
  const weightSubLabel = latest?.recordedAt
    ? new Date(latest.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Tap to log today’s weight';

  const handleSaveSexActivity = async (next: { sex: Sex; activityLevel: ActivityLevel }) => {
    if (!session?.user?.id) return;

    if (!goals) {
      Alert.alert('Set up required', 'Please complete goal setup first.');
      handleAdjustGoals();
      return;
    }

    const weightKgForCalc = displayedWeightKg ?? goals.weightKg;
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
  };

  const handleSaveWeightToday = async (weightKg: number) => {
    if (!session?.user?.id) return;

    const success = await addToday(session.user.id, weightKg);
    if (!success) {
      const message = useUserWeightLogStore.getState().error ?? 'Unable to save your weight.';
      Alert.alert('Save failed', message);
      return;
    }

    if (!goals) return;

    const sex = goals.sex ?? 'male';
    const activityLevel = goals.activityLevel ?? 'sedentary';
    const plan = calculateNutritionPlan(
      weightKg,
      goals.heightCm,
      calculateAge(goals.birthdate),
      goals.goalType,
      goals.targetWeightKg,
      sex,
      activityLevel
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
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileHeader} elevation="sm">
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color={DesignColors.gray600} />
            </View>
            <View style={styles.profileHeaderCopy}>
              <ThemedText style={styles.profileHeaderTitle}>Profile</ThemedText>
              <ThemedText style={styles.profileHeaderSubtitle}>
                {session?.user?.email ?? 'Not signed in'}
              </ThemedText>
            </View>
            {goalsLoading || weightLoading ? <Badge label="Syncing" tone="neutral" /> : null}
          </View>
          {goalsError ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={18} color={DesignColors.warningDark} />
              <ThemedText style={styles.bannerText}>{goalsError}</ThemedText>
            </View>
          ) : null}
        </Card>

        {/* Personal Info */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>
            {!hasGoals ? <Badge label="Not set" tone="warning" /> : <Badge label="Required" tone="info" />}
          </View>
          <ListRow
            title="Biological Sex"
            subtitle={getSexLabel(goals?.sex ?? null)}
            onPress={() => (hasGoals ? setSexActivityModalVisible(true) : handleAdjustGoals())}
            leftIcon={<Ionicons name="male-female-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
          <ListRow
            title="Current Weight"
            subtitle={weightSubLabel}
            onPress={() => setWeightModalVisible(true)}
            leftIcon={<Ionicons name="fitness-outline" size={20} color={DesignColors.black} />}
            accessory={<Chip label={weightLabel} selected={false} />}
          />
          <ListRow
            title="Height"
            subtitle={goals?.heightCm != null ? `${Math.round(goals.heightCm)} cm` : 'Not set'}
            onPress={handleAdjustGoals}
            leftIcon={<Ionicons name="resize-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
          <ListRow
            title="Date of Birth"
            subtitle={`${birthdateLabel} • ${ageLabel}`}
            onPress={handleAdjustGoals}
            leftIcon={<Ionicons name="calendar-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
          <ListRow
            title="Activity Level"
            subtitle={getActivityLabel(goals?.activityLevel ?? null)}
            onPress={() => (hasGoals ? setSexActivityModalVisible(true) : handleAdjustGoals())}
            leftIcon={<Ionicons name="walk-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
        </Card>

        {/* Goals */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Goals</ThemedText>
            {hasGoals && dailyTargets ? (
              <Chip label={`${dailyTargets.calories} cal/day`} />
            ) : (
              <Badge label="Not set" tone="warning" />
            )}
          </View>
          <ListRow
            title="Adjust Goals"
            subtitle={hasGoals && dailyTargets ? `Daily target: ${dailyTargets.calories} cal` : 'Set your calorie and macro targets'}
            onPress={handleAdjustGoals}
            leftIcon={<Ionicons name="nutrition-outline" size={20} color={DesignColors.black} />}
            accessory={<Ionicons name="chevron-forward" size={20} color={DesignColors.gray400} />}
          />
        </Card>

        {/* Preferences */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
            <Badge label="Coming soon" tone="neutral" />
          </View>
          <ListRow
            title="Units"
            subtitle="Metric"
            leftIcon={<Ionicons name="swap-horizontal" size={20} color={DesignColors.black} />}
            accessory={<Chip label="Metric" selected />}
          />
          <ListRow
            title="Reminders"
            subtitle="Set meal reminders"
            leftIcon={<Ionicons name="alarm-outline" size={20} color={DesignColors.black} />}
            accessory={<Badge label="Off" tone="neutral" />}
          />
          <ListRow
            title="Theme"
            subtitle="Light"
            leftIcon={<Ionicons name="color-palette-outline" size={20} color={DesignColors.black} />}
            accessory={<Badge label="Light" tone="neutral" />}
          />
        </Card>
      </ScrollView>

      <SexActivityModal
        visible={sexActivityModalVisible}
        sex={goals?.sex ?? 'male'}
        activityLevel={goals?.activityLevel ?? 'sedentary'}
        onClose={() => setSexActivityModalVisible(false)}
        onSave={handleSaveSexActivity}
      />

      <WeightEntryModal
        visible={weightModalVisible}
        initialWeightKg={displayedWeightKg}
        onClose={() => setWeightModalVisible(false)}
        onSave={handleSaveWeightToday}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 20,
  },
  profileHeader: {
    padding: 20,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  profileHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  profileHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DesignColors.black,
  },
  profileHeaderSubtitle: {
    fontSize: 13,
    color: DesignColors.gray500,
  },
  banner: {
    marginTop: 12,
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
    fontSize: 13,
    color: DesignColors.warningDark,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
  },
  sectionCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
