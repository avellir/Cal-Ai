import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export function ListRow({
  title,
  subtitle,
  accessory,
  leftIcon,
  onPress,
  style,
  disabled = false,
}: ListRowProps) {
  const content = (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {accessory}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: BorderRadius.lg,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: DesignColors.white,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DesignColors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  subtitle: {
    ...Typography.caption,
    color: DesignColors.gray500,
  },
});
