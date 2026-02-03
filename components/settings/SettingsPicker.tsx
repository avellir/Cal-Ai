import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type SettingsPickerProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  options: string[];
  onSelect: (option: string) => void;
  isLast?: boolean;
};

export function SettingsPicker({ icon, label, value, options, onSelect, isLast = false }: SettingsPickerProps) {
  const open = useCallback(() => {
    const selectedIndex = Math.max(0, options.indexOf(value));

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
          userInterfaceStyle: 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === options.length) return;
          const next = options[buttonIndex];
          if (!next) return;
          onSelect(next);
        }
      );
      return;
    }

    Alert.alert(
      label,
      undefined,
      [
        ...options.map((opt) => ({
          text: opt,
          onPress: () => onSelect(opt),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [label, onSelect, options, value]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          /* no-op */
        });
        open();
      }}
      style={[styles.row, !isLast ? styles.rowBorder : null]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={DesignColors.iosSecondaryLabel} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={DesignColors.iosSecondaryLabel} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
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
    maxWidth: 160,
  },
});
