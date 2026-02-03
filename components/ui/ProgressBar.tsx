import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { DesignColors } from '@/constants/theme';

type ProgressBarProps = {
  progress: number; // 0-1
  color?: string;
  gradientColors?: string[];
  backgroundColor?: string;
  height?: number;
  style?: ViewStyle;
};

export function ProgressBar({
  progress,
  color = DesignColors.primary,
  gradientColors,
  backgroundColor = DesignColors.gray200,
  height = 8,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(progress, 1));
  const [trackWidth, setTrackWidth] = useState(0);
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    if (trackWidth === 0) return;
    animatedWidth.value = withSpring(clamped * trackWidth, {
      damping: 15,
      stiffness: 150,
    });
  }, [clamped, trackWidth, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
  }));

  return (
    <View
      style={[styles.track, { backgroundColor, height }, style]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fillContainer, animatedStyle, { borderRadius: height / 2 }]}>
        {gradientColors && gradientColors.length >= 2 ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { borderRadius: height / 2 }]}
          />
        ) : (
          <View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fillContainer: {
    height: '100%',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
  },
});
