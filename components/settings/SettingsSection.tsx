import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DesignColors } from '@/constants/theme';

type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
  isFirst?: boolean;
};

export function SettingsSection({ title, children, isFirst = false }: SettingsSectionProps) {
  return (
    <View style={[styles.section, { marginTop: isFirst ? 16 : 32 }]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.container}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 0,
  },
  title: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: DesignColors.iosSecondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  container: {
    marginHorizontal: 16,
    backgroundColor: DesignColors.iosSecondaryBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
