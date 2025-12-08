import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

export default function TargetWeightScreen() {
  const router = useRouter();
  const {
    setTargetWeight: saveTargetWeight,
    unitSystem,
    weightKg,
    goalType,
    targetWeightKg: savedTargetWeightKg
  } = useGoalFlow();

  // Get current weight from context
  const currentWeightKg = weightKg || 70;
  const currentWeightLbs = Math.round(currentWeightKg * 2.20462);

  // Initialize target weight
  const defaultTargetKg = savedTargetWeightKg || (goalType === 'lose' ? currentWeightKg - 5 : currentWeightKg + 5);
  const defaultTargetLbs = Math.round(defaultTargetKg * 2.20462);

  const [targetWeight, setTargetWeight] = useState<number>(
    unitSystem === 'imperial' ? defaultTargetLbs : defaultTargetKg
  );

  const currentWeight = unitSystem === 'imperial' ? currentWeightLbs : currentWeightKg;
  const weightDifference = Math.abs(targetWeight - currentWeight);

  // Unrealistic threshold in the current unit system
  const UNREALISTIC_THRESHOLD = unitSystem === 'imperial' ? 50 : 23; // ~50 lbs or ~23 kg
  const isRealistic = weightDifference <= UNREALISTIC_THRESHOLD;

  // Check if target weight matches goal type
  const isValidForGoal = goalType === 'lose'
    ? targetWeight < currentWeight
    : targetWeight > currentWeight;

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

  const getFeedbackText = () => {
    if (!isValidForGoal) {
      if (goalType === 'lose') {
        return 'Target weight must be less than your current weight for weight loss';
      } else {
        return 'Target weight must be more than your current weight for weight gain';
      }
    }

    if (!isRealistic) {
      const unit = unitSystem === 'imperial' ? 'lbs' : 'kg';
      return `A ${Math.round(weightDifference)} ${unit} change is very ambitious. Consider a more gradual approach for sustainable results.`;
    }

    const unit = unitSystem === 'imperial' ? 'lbs' : 'kg';
    return `Great! A ${Math.round(weightDifference)} ${unit} change is realistic and achievable.`;
  };

  const handleContinue = () => {
    // Convert to kg if needed
    const targetWeightKg = unitSystem === 'imperial' 
      ? targetWeight / 2.20462 
      : targetWeight;

    // Save to context
    saveTargetWeight(targetWeightKg);
    router.push('/goal-flow/calculation');
  };

  return (
    <GoalFlowLayout
      currentStep={4}
      totalSteps={6}
      title="What is your desired weight?"
      subtitle="Set a realistic target to help us create your plan">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Weight Display */}
        <View style={styles.currentWeightCard}>
          <Text style={styles.currentWeightLabel}>Current weight</Text>
          <Text style={styles.currentWeightValue}>
            {currentWeight} {unitSystem === 'imperial' ? 'lbs' : 'kg'}
          </Text>
        </View>

        {/* Target Weight Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Target weight</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={targetWeight.toString()}
              onChangeText={(text: string) => {
                const numValue = parseFloat(text);
                if (!isNaN(numValue) && numValue > 0) {
                  setTargetWeight(numValue);
                } else if (text === '') {
                  setTargetWeight(0);
                }
              }}
              keyboardType="numeric"
              placeholder="Enter target weight"
              placeholderTextColor={DesignColors.gray400}
            />
            <Text style={styles.inputUnit}>
              {unitSystem === 'imperial' ? 'lbs' : 'kg'}
            </Text>
          </View>
        </View>

        {/* Weight Difference Display */}
        <View style={styles.differenceCard}>
          <View style={styles.differenceRow}>
            <Ionicons
              name={goalType === 'lose' ? 'trending-down' : 'trending-up'}
              size={24}
              color={DesignColors.black}
            />
            <Text style={styles.differenceText}>
              {goalType === 'lose' ? 'Lose' : 'Gain'} {weightDifference}{' '}
              {unitSystem === 'imperial' ? 'lbs' : 'kg'}
            </Text>
          </View>
        </View>

        {/* Feedback Message */}
        <View
          style={[
            styles.feedbackCard,
            !isValidForGoal && styles.feedbackCardWarning,
            isRealistic && isValidForGoal && styles.feedbackCardSuccess,
          ]}
        >
          <Ionicons
            name={
              !isValidForGoal
                ? 'warning'
                : isRealistic
                  ? 'checkmark-circle'
                  : 'information-circle'
            }
            size={20}
            color={
              !isValidForGoal
                ? DesignColors.error
                : isRealistic
                  ? DesignColors.success
                  : DesignColors.warning
            }
          />
          <Text
            style={[
              styles.feedbackText,
              !isValidForGoal && styles.feedbackTextWarning,
              isRealistic && isValidForGoal && styles.feedbackTextSuccess,
            ]}
          >
            {getFeedbackText()}
          </Text>
        </View>

        {/* Continue Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !isValidForGoal && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            onPressIn={isValidForGoal ? handleButtonPressIn : undefined}
            onPressOut={isValidForGoal ? handleButtonPressOut : undefined}
            disabled={!isValidForGoal}
          >
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
    paddingBottom: 40,
  },
  title: {
    ...Typography.title,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.subtitle,
    fontWeight: '400',
    marginBottom: Layout.sectionGap,
    lineHeight: 22,
  },
  currentWeightCard: {
    backgroundColor: DesignColors.gray100,
    borderRadius: BorderRadius.large,
    padding: Layout.horizontalPadding,
    marginBottom: Layout.sectionGap,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentWeightLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.gray500,
  },
  currentWeightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
  },
  inputSection: {
    marginBottom: Layout.sectionGap,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.black,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.large,
    borderWidth: 2,
    borderColor: DesignColors.gray200,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
    padding: 0,
  },
  inputUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: DesignColors.gray500,
    marginLeft: Spacing.md,
  },
  differenceCard: {
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  differenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  differenceText: {
    fontSize: 18,
    fontWeight: '600',
    color: DesignColors.black,
  },
  feedbackCard: {
    backgroundColor: DesignColors.gray100,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
  },
  feedbackCardWarning: {
    backgroundColor: DesignColors.errorRedBg,
  },
  feedbackCardSuccess: {
    backgroundColor: DesignColors.successGreenBg,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DesignColors.warningDark,
    lineHeight: 20,
  },
  feedbackTextWarning: {
    color: DesignColors.error,
  },
  feedbackTextSuccess: {
    color: DesignColors.successDark,
  },
  continueButton: {
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  continueButtonDisabled: {
    backgroundColor: DesignColors.gray300,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignColors.white,
  },
});
