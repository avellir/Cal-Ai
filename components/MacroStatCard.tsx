import { type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DesignColors, Shadows } from '@/constants/theme';

type MacroStatCardProps = {
  label: string;
  value: number;
  percent: number;
  color: string;
  iconBg: string;
  Icon: LucideIcon;
};

export function MacroStatCard({ label, value, percent, color, iconBg, Icon }: MacroStatCardProps) {
  return (
    <Card style={[styles.card, Shadows.soft]} elevation="none">
      {/* Row 1: Icon + Value */}
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: iconBg }]}>
          <Icon size={18} color={color} strokeWidth={2} />
        </View>
        <Text style={styles.value}>{Math.round(value)}g</Text>
      </View>

      {/* Row 2: Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Row 3: Progress Bar */}
      <ProgressBar progress={percent / 100} color={color} height={6} style={styles.progressBar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: DesignColors.white,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: DesignColors.black,
  },
  label: {
    fontSize: 12,
    color: DesignColors.gray600,
  },
  progressBar: {
    width: '100%',
    borderRadius: 3,
  },
});
