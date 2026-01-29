import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import type { ActivityLevel, Sex } from '@/lib/user-goals-types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  title: string;
  subtitle: string;
  multiplier: string;
}[] = [
  { value: 'sedentary', title: 'Sedentary', subtitle: 'Little or no exercise', multiplier: '1.2×' },
  { value: 'light', title: 'Lightly active', subtitle: '1–3 days/week', multiplier: '1.375×' },
  { value: 'moderate', title: 'Moderately active', subtitle: '3–5 days/week', multiplier: '1.55×' },
  { value: 'active', title: 'Active', subtitle: '6–7 days/week', multiplier: '1.725×' },
  { value: 'veryActive', title: 'Very active', subtitle: 'Hard training & physical job', multiplier: '1.9×' },
];

export default function SexActivityScreen() {
  const router = useRouter();
  const { sex: savedSex, activityLevel: savedActivityLevel, setSexActivity } = useGoalFlow();
  const [sex, setSex] = useState<Sex>(savedSex);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(savedActivityLevel);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleButtonPressIn = () => {
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: AnimationDurations.buttonPress,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: AnimationDurations.buttonPress,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = () => {
    setSexActivity(sex, activityLevel);
    router.push('/goal-flow/goal-selection');
  };

  return (
    <GoalFlowLayout
      currentStep={3}
      totalSteps={7}
      title="A few details first"
      subtitle="These help us calculate your calorie needs more accurately">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biological sex</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.choice, sex === 'male' && styles.choiceActive]}
              onPress={() => setSex('male')}
              activeOpacity={0.8}>
              <View style={[styles.choiceIcon, sex === 'male' && styles.choiceIconActive]}>
                <Ionicons name="male" size={20} color={sex === 'male' ? DesignColors.white : DesignColors.black} />
              </View>
              <Text style={[styles.choiceText, sex === 'male' && styles.choiceTextActive]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choice, sex === 'female' && styles.choiceActive]}
              onPress={() => setSex('female')}
              activeOpacity={0.8}>
              <View style={[styles.choiceIcon, sex === 'female' && styles.choiceIconActive]}>
                <Ionicons name="female" size={20} color={sex === 'female' ? DesignColors.white : DesignColors.black} />
              </View>
              <Text style={[styles.choiceText, sex === 'female' && styles.choiceTextActive]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity level</Text>
          <View style={styles.list}>
            {ACTIVITY_OPTIONS.map((option) => {
              const selected = option.value === activityLevel;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.activityCard, selected && styles.activityCardActive]}
                  onPress={() => setActivityLevel(option.value)}
                  activeOpacity={0.85}>
                  <View style={styles.activityLeft}>
                    <Text style={[styles.activityTitle, selected && styles.activityTitleActive]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.activitySubtitle, selected && styles.activitySubtitleActive]}>
                      {option.subtitle}
                    </Text>
                  </View>
                  <View style={[styles.multiplierPill, selected && styles.multiplierPillActive]}>
                    <Text style={[styles.multiplierText, selected && styles.multiplierTextActive]}>
                      {option.multiplier}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            activeOpacity={0.9}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </GoalFlowLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.padding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: DesignColors.gray600,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  choice: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    backgroundColor: DesignColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  choiceActive: {
    backgroundColor: DesignColors.primary,
    borderColor: DesignColors.primary,
  },
  choiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DesignColors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  choiceText: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  choiceTextActive: {
    color: DesignColors.white,
  },
  list: {
    gap: Spacing.md,
  },
  activityCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    backgroundColor: DesignColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  activityCardActive: {
    borderColor: DesignColors.primary,
    backgroundColor: DesignColors.primaryBg,
  },
  activityLeft: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  activityTitleActive: {
    color: DesignColors.primaryDark,
  },
  activitySubtitle: {
    ...Typography.caption,
    color: DesignColors.gray500,
  },
  activitySubtitleActive: {
    color: DesignColors.gray600,
  },
  multiplierPill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: DesignColors.gray100,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  multiplierPillActive: {
    backgroundColor: DesignColors.white,
    borderColor: DesignColors.primary,
  },
  multiplierText: {
    ...Typography.caption,
    color: DesignColors.black,
  },
  multiplierTextActive: {
    color: DesignColors.primaryDark,
  },
  continueButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: DesignColors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  continueButtonText: {
    ...Typography.bodyBold,
    color: DesignColors.white,
  },
});
