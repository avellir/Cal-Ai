import { GoalFlowLayout } from '@/components/goal-flow/GoalFlowLayout';
import { AnimationDurations, BorderRadius, DesignColors, Layout, Spacing, Typography } from '@/constants/theme';
import type { GoalType } from '@/lib/user-goals-types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGoalFlow } from './GoalFlowContext';

export default function GoalSelectionScreen() {
  const router = useRouter();
  const { setGoal, goalType: savedGoalType } = useGoalFlow();
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(savedGoalType);

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
    if (!selectedGoal) return;

    // Save to context
    setGoal(selectedGoal);
    router.push('/goal-flow/target-weight');
  };

  return (
    <GoalFlowLayout
      currentStep={3}
      totalSteps={6}
      title="What is your goal?"
      subtitle="Choose your fitness objective to get personalized recommendations">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Goal Cards */}
        <View style={styles.goalsContainer}>
          {/* Lose Weight Card */}
          <TouchableOpacity
            style={[
              styles.goalCard,
              selectedGoal === 'lose' && styles.goalCardActive,
            ]}
            onPress={() => setSelectedGoal('lose')}
            activeOpacity={0.7}
          >
            <View style={styles.goalIconContainer}>
              <Ionicons
                name="trending-down"
                size={32}
                color={selectedGoal === 'lose' ? DesignColors.white : DesignColors.black}
              />
            </View>
            <Text
              style={[
                styles.goalTitle,
                selectedGoal === 'lose' && styles.goalTitleActive,
              ]}
            >
              Lose weight
            </Text>
            <Text
              style={[
                styles.goalDescription,
                selectedGoal === 'lose' && styles.goalDescriptionActive,
              ]}
            >
              Create a calorie deficit to reach your target weight
            </Text>
          </TouchableOpacity>

          {/* Gain Weight Card */}
          <TouchableOpacity
            style={[
              styles.goalCard,
              selectedGoal === 'gain' && styles.goalCardActive,
            ]}
            onPress={() => setSelectedGoal('gain')}
            activeOpacity={0.7}
          >
            <View style={styles.goalIconContainer}>
              <Ionicons
                name="trending-up"
                size={32}
                color={selectedGoal === 'gain' ? DesignColors.white : DesignColors.black}
              />
            </View>
            <Text
              style={[
                styles.goalTitle,
                selectedGoal === 'gain' && styles.goalTitleActive,
              ]}
            >
              Gain weight
            </Text>
            <Text
              style={[
                styles.goalDescription,
                selectedGoal === 'gain' && styles.goalDescriptionActive,
              ]}
            >
              Create a calorie surplus to reach your target weight
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedGoal && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            onPressIn={selectedGoal ? handleButtonPressIn : undefined}
            onPressOut={selectedGoal ? handleButtonPressOut : undefined}
            disabled={!selectedGoal}
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
    marginBottom: Spacing.xxxl,
    lineHeight: 22,
  },
  goalsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  goalCard: {
    backgroundColor: DesignColors.gray50,
    borderRadius: BorderRadius.xlarge,
    borderWidth: 2,
    borderColor: DesignColors.gray200,
    padding: Layout.sectionGap,
    alignItems: 'center',
  },
  goalCardActive: {
    backgroundColor: DesignColors.primary,
    borderColor: DesignColors.primary,
  },
  goalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DesignColors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  goalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: DesignColors.black,
    marginBottom: Spacing.sm,
  },
  goalTitleActive: {
    color: DesignColors.white,
  },
  goalDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: DesignColors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalDescriptionActive: {
    color: DesignColors.gray300,
  },
  continueButton: {
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: DesignColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
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
