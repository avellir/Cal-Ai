import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SexActivityModal } from '@/components/SexActivityModal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { DesignColors } from '@/constants/theme';
import { useSessionStore } from '@/lib/session-store';
import { calculateAge, type ActivityLevel, type Sex } from '@/lib/user-goals-types';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { patchUserGoals } from '@/services/userGoals';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { useUserWeightLogStore } from '@/store/userWeightLogStore';

function StaticRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.staticRow, !isLast ? styles.staticRowBorder : null]}>
      <Text style={styles.staticLabel}>{label}</Text>
      <Text style={styles.staticValue}>{value}</Text>
    </View>
  );
}

export default function BodyMetricsScreen() {
  const { session } = useSessionStore();
  const { goals, fetchGoals } = useUserGoalsStore();
  const { latest, fetchLatest } = useUserWeightLogStore();
  const [sexModalVisible, setSexModalVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchGoals(session.user.id);
    fetchLatest(session.user.id);
  }, [fetchGoals, fetchLatest, session?.user?.id]);

  const birthdateLabel = useMemo(() => {
    if (!goals?.birthdate) return 'Not set';
    return new Date(goals.birthdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [goals?.birthdate]);

  const heightLabel = goals?.heightCm != null ? `${Math.round(goals.heightCm)} cm` : 'Not set';
  const sexLabel = goals?.sex ? (goals.sex === 'male' ? 'Male' : 'Female') : 'Not set';
  const ageLabel = goals?.birthdate ? `${calculateAge(goals.birthdate)} years` : '—';

  const handleSaveSex = async (next: { sex: Sex; activityLevel: ActivityLevel }) => {
    if (!session?.user?.id) return;

    if (!goals) {
      router.push('/(app)/goal-flow' as any);
      return;
    }

    const displayedWeightKg = latest?.weightKg ?? goals.weightKg ?? null;
    const heightCmForCalc = goals.heightCm;
    if (displayedWeightKg == null || heightCmForCalc == null) {
      router.push('/(app)/goal-flow' as any);
      return;
    }

    const plan = calculateNutritionPlan(
      displayedWeightKg,
      heightCmForCalc,
      calculateAge(goals.birthdate),
      goals.goalType,
      goals.targetWeightKg,
      next.sex,
      goals.activityLevel ?? next.activityLevel
    );

    const { data, error } = await patchUserGoals(session.user.id, {
      sex: next.sex,
      daily_calories: plan.dailyCalories,
      daily_protein_g: plan.dailyProtein,
      daily_carbs_g: plan.dailyCarbs,
      daily_fat_g: plan.dailyFat,
    });

    if (error || !data) {
      return;
    }

    useUserGoalsStore.setState({ goals: data, error: null });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Animated.View style={styles.screen} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)}>
        <Stack.Screen options={{ title: 'Body Metrics' }} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SettingsSection title="About You" isFirst>
            <SettingsRow
              icon="male-female-outline"
              label="Biological Sex"
              value={sexLabel}
              onPress={() => setSexModalVisible(true)}
            />
            <SettingsRow
              icon="resize-outline"
              label="Height"
              value={heightLabel}
              onPress={() => router.push('/goal-flow/height-weight' as any)}
            />
            <SettingsRow
              icon="calendar-outline"
              label="Date of Birth"
              value={birthdateLabel}
              onPress={() => router.push('/goal-flow/birthdate' as any)}
            />
            <StaticRow label="Age" value={ageLabel} isLast />
          </SettingsSection>

          <Text style={styles.helper}>Used to calculate your BMR and daily targets.</Text>
        </ScrollView>

        <SexActivityModal
          visible={sexModalVisible}
          mode="sex"
          sex={(goals?.sex ?? 'male') as Sex}
          activityLevel={goals?.activityLevel ?? 'sedentary'}
          onClose={() => setSexModalVisible(false)}
          onSave={handleSaveSex}
        />
      </Animated.View>
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  helper: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: DesignColors.iosSecondaryLabel,
  },
  staticRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignColors.iosSecondaryBackground,
  },
  staticRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  staticLabel: {
    flex: 1,
    fontSize: 16,
    color: DesignColors.iosLabel,
  },
  staticValue: {
    fontSize: 16,
    color: DesignColors.iosSecondaryLabel,
  },
});
