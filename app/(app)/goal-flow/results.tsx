import { CircularProgress } from '@/components/goal-flow/CircularProgress';
import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import { useSessionStore } from '@/lib/session-store';
import type { GoalFlowData } from '@/lib/user-goals-types';
import { calculateNutritionPlan } from '@/services/goalCalculation';
import { addUserWeightEntry } from '@/services/userWeightEntries';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

type MacroCircleProps = {
  value: number;
  unit: string;
  label: string;
  color: string;
  backgroundColor: string;
  delay?: number;
};

function MacroCircle({ value, unit, label, color, backgroundColor, delay = 0 }: MacroCircleProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, scaleAnim]);

  return (
    <Animated.View style={[styles.macroCircle, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.circleContainer, { backgroundColor }]}>
        <CircularProgress
          size={120}
          strokeWidth={8}
          progress={100}
          color={color}
          backgroundColor={backgroundColor}
          animated={true}
        >
          <View style={styles.circleContent}>
            <Text style={styles.macroValue}>{value}</Text>
            <Text style={styles.macroUnit}>{unit}</Text>
          </View>
        </CircularProgress>
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="pencil" size={16} color={DesignColors.black} />
        </TouchableOpacity>
      </View>
      <Text style={styles.macroLabel}>{label}</Text>
    </Animated.View>
  );
}

const PENDING_GOALS_KEY = 'pending_goals_sync';

export default function ResultsScreen() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { session } = useSessionStore();
  const { saveGoals } = useUserGoalsStore();
  const {
    getState,
    clearState,
    unitSystem,
    goalType,
    targetWeightKg,
    estimatedWeeksToGoal,
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat,
    heightCm,
    weightKg,
    age,
    sex,
    activityLevel,
    setCalculatedValues
  } = useGoalFlow();

  // Calculate recommended values if not already set
  const getRecommendedValues = () => {
    // If values are already calculated, use them
    if (dailyCalories && dailyProtein && dailyCarbs && dailyFat) {
      return {
        calories: dailyCalories,
        protein: dailyProtein,
        carbs: dailyCarbs,
        fat: dailyFat,
        weeks: estimatedWeeksToGoal || 0
      };
    }

    // Otherwise, calculate recommended values
    if (heightCm && weightKg && age && goalType && targetWeightKg) {
      const nutritionPlan = calculateNutritionPlan(
        weightKg,
        heightCm,
        age,
        goalType,
        targetWeightKg,
        sex,
        activityLevel
      );

      return {
        calories: nutritionPlan.dailyCalories,
        protein: nutritionPlan.dailyProtein,
        carbs: nutritionPlan.dailyCarbs,
        fat: nutritionPlan.dailyFat,
        weeks: nutritionPlan.estimatedWeeksToGoal
      };
    }

    // Fallback to 0 if no data available
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      weeks: 0
    };
  };

  const recommendedValues = getRecommendedValues();

  // Ensure values are calculated and saved to context on mount if missing
  React.useEffect(() => {
    if (!dailyCalories && heightCm && weightKg && age && goalType && targetWeightKg) {
      const nutritionPlan = calculateNutritionPlan(
        weightKg,
        heightCm,
        age,
        goalType,
        targetWeightKg,
        sex,
        activityLevel
      );

      setCalculatedValues(
        nutritionPlan.dailyCalories,
        nutritionPlan.dailyProtein,
        nutritionPlan.dailyCarbs,
        nutritionPlan.dailyFat,
        nutritionPlan.estimatedWeeksToGoal
      );
    }
  }, [dailyCalories, heightCm, weightKg, age, sex, activityLevel, goalType, targetWeightKg, setCalculatedValues]);

  // Format goal summary
  const getGoalSummary = () => {
    if (!goalType || !targetWeightKg || !recommendedValues.weeks) {
      return 'Your custom plan is ready!';
    }

    const targetWeight = unitSystem === 'imperial'
      ? Math.round(targetWeightKg * 2.20462)
      : Math.round(targetWeightKg);
    const unit = unitSystem === 'imperial' ? 'lbs' : 'kg';
    const action = goalType === 'lose' ? 'lose' : 'gain';

    // Calculate target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (recommendedValues.weeks * 7));
    const formattedDate = targetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    return `You should ${action}: ${targetWeight} ${unit} by ${formattedDate}`;
  };

  const savePendingGoals = async (goalFlowData: GoalFlowData, userId: string) => {
    try {
      const pendingData = {
        goalFlowData,
        userId,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(PENDING_GOALS_KEY, JSON.stringify(pendingData));
    } catch (error) {
      console.error('Failed to save pending goals:', error);
    }
  };

  const clearPendingGoals = async () => {
    try {
      await AsyncStorage.removeItem(PENDING_GOALS_KEY);
    } catch (error) {
      console.error('Failed to clear pending goals:', error);
    }
  };

  const handleGetStarted = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to save your goals.');
      return;
    }

    const state = getState();

    // Validate all required base data is present
    if (!state.heightCm || !state.weightKg || !state.birthdate ||
      !state.age || !state.goalType || !state.targetWeightKg) {
      Alert.alert('Error', 'Missing required data. Please go through the flow again.');
      return;
    }

    // Validate that we have calculated values (either from state or recommended)
    const finalCalories = state.dailyCalories || recommendedValues.calories;
    const finalProtein = state.dailyProtein || recommendedValues.protein;
    const finalCarbs = state.dailyCarbs || recommendedValues.carbs;
    const finalFat = state.dailyFat || recommendedValues.fat;

    if (!finalCalories || !finalProtein || !finalCarbs || !finalFat) {
      Alert.alert('Error', 'Unable to calculate nutrition values. Please try again.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Prepare data for saving (use recommended values if not already set)
      const goalFlowData: GoalFlowData = {
        unitSystem: state.unitSystem,
        heightCm: state.heightCm,
        weightKg: state.weightKg,
        birthdate: state.birthdate,
        age: state.age,
        sex: state.sex,
        activityLevel: state.activityLevel,
        goalType: state.goalType,
        targetWeightKg: state.targetWeightKg,
        dailyCalories: finalCalories,
        dailyProtein: finalProtein,
        dailyCarbs: finalCarbs,
        dailyFat: finalFat,
      };

      // Save to Supabase
      const success = await saveGoals(goalFlowData, session.user.id);

      if (success) {
        // Clear any pending goals
        await clearPendingGoals();

        // Seed/update the weight log with the current weight captured in the flow.
        // If this fails (e.g. user hasn't applied migrations yet), we don't block onboarding.
        await addUserWeightEntry(session.user.id, goalFlowData.weightKg).catch(() => null);

        // Clear context state
        clearState();

        // Navigate to home/settings
        router.replace('/(app)/(tabs)' as any);
      } else {
        // Save failed - store locally for later sync
        await savePendingGoals(goalFlowData, session.user.id);
        setSaveError('Unable to save goals. Please check your connection.');
      }
    } catch (error) {
      console.error('Error saving goals:', error);

      // Store locally for later sync (use the same final values)
      const goalFlowData: GoalFlowData = {
        unitSystem: state.unitSystem,
        heightCm: state.heightCm!,
        weightKg: state.weightKg!,
        birthdate: state.birthdate!,
        age: state.age!,
        sex: state.sex,
        activityLevel: state.activityLevel,
        goalType: state.goalType!,
        targetWeightKg: state.targetWeightKg!,
        dailyCalories: finalCalories,
        dailyProtein: finalProtein,
        dailyCarbs: finalCarbs,
        dailyFat: finalFat,
      };
      await savePendingGoals(goalFlowData, session.user.id);
      setSaveError('An unexpected error occurred. Your goals are saved locally.');
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleRetry = () => {
    setSaveError(null);
    handleGetStarted();
  };

  return (
    <GoalFlowLayout
      currentStep={7}
      totalSteps={7}
      title="Congratulations your custom plan is ready!"
      subtitle="You can edit these values anytime.">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header */}
        <View style={styles.header}>
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={64} color={DesignColors.success} />
          </View>
          <Text style={styles.title}>
            Congratulations your custom plan is ready!
          </Text>
        </View>

        {/* Goal Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{getGoalSummary()}</Text>
        </View>

        {/* Daily Recommendation Label */}
        <View style={styles.recommendationHeader}>
          <Text style={styles.recommendationTitle}>Daily recommendation</Text>
          <Text style={styles.recommendationSubtitle}>
            You can edit this anytime
          </Text>
        </View>

        {/* Macro Circles Grid */}
        <View style={styles.macrosGrid}>
          <MacroCircle
            value={recommendedValues.calories}
            unit="cal"
            label="Calories"
            color={DesignColors.black}
            backgroundColor={DesignColors.gray100}
            delay={0}
          />
          <MacroCircle
            value={recommendedValues.protein}
            unit="g"
            label="Protein"
            color={DesignColors.proteinRed}
            backgroundColor={DesignColors.proteinRedBg}
            delay={100}
          />
          <MacroCircle
            value={recommendedValues.carbs}
            unit="g"
            label="Carbs"
            color={DesignColors.carbsOrange}
            backgroundColor={DesignColors.carbsOrangeBg}
            delay={200}
          />
          <MacroCircle
            value={recommendedValues.fat}
            unit="g"
            label="Fat"
            color={DesignColors.fatBlue}
            backgroundColor={DesignColors.fatBlueBg}
            delay={300}
          />
        </View>

        {/* Error Message */}
        {saveError ? (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons name="warning" size={20} color={DesignColors.error} />
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={isSaving}
            >
              <Ionicons name="refresh" size={18} color={DesignColors.black} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Get Started Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[styles.getStartedButton, isSaving && styles.getStartedButtonDisabled]}
            onPress={handleGetStarted}
            onPressIn={!isSaving ? handleButtonPressIn : undefined}
            onPressOut={!isSaving ? handleButtonPressOut : undefined}
            disabled={isSaving}
          >
            <Text style={styles.getStartedButtonText}>
              {isSaving ? 'Saving...' : "Let's get started!"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Progress Bar */}
        <View style={styles.finalProgressBar}>
          <View style={styles.finalProgressFill} />
        </View>
      </ScrollView>
    </GoalFlowLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.sectionGap,
  },
  checkmarkContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
    textAlign: 'center',
    lineHeight: 32,
    paddingHorizontal: Layout.horizontalPadding,
  },
  summaryCard: {
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.large,
    padding: Layout.horizontalPadding,
    marginBottom: Spacing.xxxl,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
    textAlign: 'center',
    lineHeight: 24,
  },
  recommendationHeader: {
    marginBottom: Layout.horizontalPadding,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DesignColors.black,
    marginBottom: 4,
  },
  recommendationSubtitle: {
    ...Typography.label,
    fontWeight: '400',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  macroCircle: {
    width: '47%',
    alignItems: 'center',
  },
  circleContainer: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  circleContent: {
    alignItems: 'center',
  },
  macroValue: {
    ...Typography.displayMedium,
  },
  macroUnit: {
    ...Typography.label,
  },
  editButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DesignColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DesignColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  macroLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
  },
  errorCard: {
    backgroundColor: DesignColors.errorRedBg,
    borderRadius: BorderRadius.large,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DesignColors.errorRedDark,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: DesignColors.white,
    borderRadius: BorderRadius.medium,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: DesignColors.errorRedBorder,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DesignColors.black,
  },
  getStartedButton: {
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.sectionGap,
  },
  getStartedButtonDisabled: {
    backgroundColor: DesignColors.gray300,
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.white,
  },
  finalProgressBar: {
    height: 4,
    backgroundColor: DesignColors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  finalProgressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: DesignColors.black,
    borderRadius: 2,
  },
});
