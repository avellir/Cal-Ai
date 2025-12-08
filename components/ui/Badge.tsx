import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

type BadgeProps = {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
};

const toneMap: Record<Tone, { bg: string; color: string; border: string }> = {
  neutral: { bg: DesignColors.gray100, color: DesignColors.black, border: DesignColors.gray200 },
  success: { bg: DesignColors.successBg, color: DesignColors.success, border: DesignColors.successBorder },
  warning: { bg: DesignColors.warningBg, color: DesignColors.warning, border: DesignColors.warningBorder },
  error: { bg: DesignColors.errorBg, color: DesignColors.error, border: DesignColors.errorBorder },
  info: { bg: DesignColors.infoBg, color: DesignColors.infoDark, border: DesignColors.info },
};

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const toneColors = toneMap[tone];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
        },
        style,
      ]}>
      <Text style={[Typography.caption, { color: toneColors.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
