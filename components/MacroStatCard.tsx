import { type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DesignColors, Shadows, Typography } from '@/constants/theme';

type MacroStatCardProps = {
  label: string;
  value: number;
  percent: number;
  color: string;
  Icon: LucideIcon;
};

function withOpacity(hex: string, opacity: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function MacroStatCard({ label, value, percent, color, Icon }: MacroStatCardProps) {
  const iconBackground = withOpacity(color, 0.15);
  const gradientColors = [withOpacity(color, 0.3), color];
  return (
    <Card style={[styles.card, Shadows.soft]} elevation="none">
      {/* Row 1: Icon + Value */}
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: iconBackground }]}>
          <Icon size={18} color={color} strokeWidth={2} />
        </View>
        <Text style={styles.value}>{Math.round(value)}g</Text>
      </View>

      {/* Row 2: Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Row 3: Progress Bar */}
      <ProgressBar
        progress={percent / 100}
        color={color}
        gradientColors={gradientColors}
        height={4}
        style={styles.progressBar}
      />
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
    ...Typography.h3,
    color: DesignColors.textPrimary,
  },
  label: {
    ...Typography.caption,
    color: DesignColors.textTertiary,
  },
  progressBar: {
    width: '100%',
    borderRadius: 3,
  },
});
