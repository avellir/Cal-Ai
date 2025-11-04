import { AnimationDurations, DesignColors, Layout, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type GoalFlowLayoutProps = {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  children: React.ReactNode;
};

export function GoalFlowLayout({
  currentStep,
  totalSteps,
  onBack,
  children,
}: GoalFlowLayoutProps) {
  const router = useRouter();
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate progress bar to current step
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: AnimationDurations.screenTransition,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage, progressAnim]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with back button and progress */}
      <View style={styles.header}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={handleBack}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={DesignColors.black} />
          </TouchableOpacity>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: progressWidth },
            ]}
          />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignColors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.horizontalPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: DesignColors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: DesignColors.black,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: Layout.verticalPadding,
  },
});
