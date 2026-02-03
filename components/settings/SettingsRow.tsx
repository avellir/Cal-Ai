import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type SettingsRowProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  rightAccessory?: ReactNode;
};

export function SettingsRow({
  icon,
  label,
  value,
  subtitle,
  onPress,
  showChevron = true,
  isLast = false,
  rightAccessory,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          /* no-op */
        });
        onPress();
      }}
      style={[styles.row, !isLast ? styles.rowBorder : null]}>
      <View style={styles.mainRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={DesignColors.iosSecondaryLabel} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}

        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}

        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={DesignColors.iosSecondaryLabel} />
        ) : null}
      </View>

      {subtitle ? (
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 16,
    color: DesignColors.iosLabel,
  },
  value: {
    marginRight: 8,
    fontSize: 16,
    color: DesignColors.iosSecondaryLabel,
    maxWidth: 140,
  },
  rightAccessory: {
    marginRight: 8,
  },
  subtitleRow: {
    marginTop: 6,
    paddingLeft: 29 + 12,
    paddingRight: 24,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: DesignColors.gray500,
  },
});
