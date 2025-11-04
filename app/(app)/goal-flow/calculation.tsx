import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

const CHECKLIST_ITEMS = [
  'Calories',
  'Carbs',
  'Protein',
  'Fats',
  'Health Score',
];

export default function CalculationScreen() {
  const router = useRouter();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const { 
    heightCm, 
    weightKg, 
    age, 
    goalType, 
    targetWeightKg,
    setCalculatedValues 
  } = useGoalFlow();

  useEffect(() => {
    // Animate progress bar with linear timing
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: AnimationDurations.progressBarFill,
      useNativeDriver: false,
    }).start();

    // Perform calculations
    if (heightCm && weightKg && age && goalType && targetWeightKg) {
      const nutritionPlan = calculateNutritionPlan(
        weightKg,
        heightCm,
        age,
        goalType,
        targetWeightKg
      );
      
      // Save calculated values to context
      setCalculatedValues(
        nutritionPlan.dailyCalories,
        nutritionPlan.dailyProtein,
        nutritionPlan.dailyCarbs,
        nutritionPlan.dailyFat,
        nutritionPlan.estimatedWeeksToGoal
      );
    }

    // Auto-advance after 2.5 seconds
    const timer = setTimeout(() => {
      router.push('/goal-flow/results');
    }, 2500);

    return () => clearTimeout(timer);
  }, [heightCm, weightKg, age, goalType, targetWeightKg, setCalculatedValues, progressAnim, router]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <GoalFlowLayout currentStep={5} totalSteps={6}>
      <View style={styles.container}>
        {/* Progress Percentage */}
        <View style={styles.progressSection}>
          <Text style={styles.progressPercentage}>92%</Text>
          <Text style={styles.progressLabel}>Almost there</Text>
        </View>

        {/* Main Message */}
        <View style={styles.messageSection}>
          <Text style={styles.mainMessage}>
            We&apos;re setting everything up for you
          </Text>
          <Text style={styles.subMessage}>Finalizing results...</Text>
        </View>

        {/* Animated Progress Bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: progressWidth },
            ]}
          />
        </View>

        {/* Checklist */}
        <View style={styles.checklistContainer}>
          {CHECKLIST_ITEMS.map((item, index) => (
            <View key={item} style={styles.checklistItem}>
              <View style={styles.checkmarkCircle}>
                <Ionicons name="checkmark" size={16} color="#10B981" />
              </View>
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Loading Indicator */}
        <View style={styles.loadingSection}>
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
          <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
        </View>
      </View>
    </GoalFlowLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  progressPercentage: {
    fontSize: 64,
    fontWeight: '700',
    color: DesignColors.black,
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.gray500,
  },
  messageSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  mainMessage: {
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 32,
  },
  subMessage: {
    ...Typography.subtitle,
    fontWeight: '400',
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: DesignColors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 40,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: DesignColors.black,
    borderRadius: 4,
  },
  checklistContainer: {
    width: '100%',
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.large,
    padding: Spacing.xl,
    gap: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DesignColors.successGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistText: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.black,
  },
  loadingSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DesignColors.black,
  },
  loadingDotDelay1: {
    opacity: 0.6,
  },
  loadingDotDelay2: {
    opacity: 0.3,
  },
});
