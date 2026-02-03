import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  variant?: Variant;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getBackground = () => {
    if (variant === 'ghost') return 'transparent';
    if (variant === 'secondary') return DesignColors.white;
    return DesignColors.primary;
  };

  const getBorder = () => {
    if (variant === 'ghost') return 'transparent';
    if (variant === 'secondary') return DesignColors.gray200;
    return 'transparent';
  };

  const getTextColor = () => {
    if (variant === 'ghost') return DesignColors.black;
    if (variant === 'secondary') return DesignColors.black;
    return DesignColors.white;
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: getBackground(),
          borderColor: getBorder(),
          opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      <View style={styles.content}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        {loading ? (
          <ActivityIndicator size="small" color={getTextColor()} />
        ) : (
          <Text style={[Typography.bodyBold, styles.label, { color: getTextColor() }]}>{label}</Text>
        )}
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    textAlign: 'center',
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
