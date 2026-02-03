import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? DesignColors.primaryBg : DesignColors.white,
          borderColor: selected ? DesignColors.primary : DesignColors.gray200,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      <Text
        style={[
          Typography.bodySmallBold,
          { color: selected ? DesignColors.primaryDark : DesignColors.black },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
