import { AnimationDurations, DesignColors } from '@/constants/theme';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type CircularProgressProps = {
  size?: number;
  strokeWidth?: number;
  progress?: number; // 0-100
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  children?: React.ReactNode;
  animated?: boolean;
};

export function CircularProgress({
  size = 120,
  strokeWidth = 8,
  progress = 0,
  color = DesignColors.black,
  backgroundColor = DesignColors.gray200,
  showPercentage = false,
  children,
  animated = true,
}: CircularProgressProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      // Animate scale for entrance
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Animate rotation for progress
      Animated.timing(rotateAnim, {
        toValue: progress,
        duration: AnimationDurations.circularProgress,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(1);
      rotateAnim.setValue(progress);
    }
  }, [progress, animated, scaleAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Background circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      />

      {/* Progress indicator - simplified visual representation */}
      {progress > 0 && (
        <Animated.View
          style={[
            styles.progressIndicator,
            {
              width: size - strokeWidth * 2,
              height: size - strokeWidth * 2,
              borderRadius: (size - strokeWidth * 2) / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              borderRightColor: progress < 50 ? 'transparent' : color,
              borderBottomColor: progress < 25 ? 'transparent' : color,
              borderLeftColor: progress < 75 ? 'transparent' : color,
              transform: [{ rotate: rotation }],
            },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {showPercentage ? (
          <Text style={styles.percentageText}>{Math.round(progress)}%</Text>
        ) : (
          children
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
  },
  progressIndicator: {
    position: 'absolute',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: DesignColors.black,
  },
});
