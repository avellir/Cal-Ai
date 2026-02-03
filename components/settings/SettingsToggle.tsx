import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type SettingsToggleProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  subtitle?: string;
  isLast?: boolean;
};

export function SettingsToggle({
  icon,
  label,
  value,
  onValueChange,
  subtitle,
  isLast = false,
}: SettingsToggleProps) {
  return (
    <View
      accessibilityRole="switch"
      accessibilityLabel={label}
      style={[styles.row, !isLast ? styles.rowBorder : null]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={DesignColors.iosSecondaryLabel} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D1D6', true: DesignColors.iosAccent }}
      />
    </View>
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
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: DesignColors.iosSecondaryLabel,
  },
});
