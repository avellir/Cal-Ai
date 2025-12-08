import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { DesignColors } from '@/constants/theme';

type ProgressBarProps = {
  progress: number; // 0-1
  color?: string;
  backgroundColor?: string;
  height?: number;
  style?: ViewStyle;
};

export function ProgressBar({
  progress,
  color = DesignColors.primary,
  backgroundColor = DesignColors.gray200,
  height = 8,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <View style={[styles.track, { backgroundColor, height }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
