import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { BorderRadius, DesignColors, Shadows, Spacing } from '@/constants/theme';

type Elevation = 'none' | 'sm' | 'md';

type CardProps = ViewProps & {
  elevation?: Elevation;
  padding?: number;
  backgroundColor?: string;
  borderColor?: string;
};

export function Card({
  children,
  style,
  elevation = 'sm',
  padding = Spacing.lg,
  backgroundColor = DesignColors.surface,
  borderColor = DesignColors.gray100,
  ...rest
}: CardProps) {
  const shadowStyle: ViewStyle =
    elevation === 'none' ? {} : elevation === 'md' ? Shadows.md : Shadows.sm;

  return (
    <View
      {...rest}
      style={[
        styles.base,
        shadowStyle,
        {
          padding,
          backgroundColor,
          borderColor,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
});
