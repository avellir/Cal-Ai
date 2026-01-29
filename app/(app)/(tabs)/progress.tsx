import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DesignColors, Shadows, Spacing, Typography } from '@/constants/theme';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CalorieTrendChart } from '@/components/CalorieTrendChart';
import { AppBackground } from '@/components/ui/AppBackground';

const SUMMARY = [
  { label: 'Current streak', value: '6 days', description: 'You logged meals every day this week.' },
  { label: 'Average calories', value: '2,180 kcal', description: 'Within your weekly target of 2,250 kcal.' },
  { label: 'Water intake', value: '82 oz', description: 'Only 6 oz away from your hydration goal.' },
];

const RANGES = ['7d', '30d', 'custom'] as const;
const TREND_DATA = [
  { value: 1950, label: 'Mon' },
  { value: 2100, label: 'Tue' },
  { value: 1875, label: 'Wed' },
  { value: 2250, label: 'Thu' },
  { value: 2050, label: 'Fri' },
  { value: 1900, label: 'Sat' },
  { value: 2150, label: 'Sun' },
];

export default function ProgressScreen() {
  // Placeholder selected range; in future hook to state
  const selectedRange = '7d';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress overview</Text>
          <Text style={styles.subtitle}>
            Keep up the momentum by reviewing the trends from your recent logs.
          </Text>
        </View>

        {/* Range chips */}
        <View style={styles.rangeRow}>
          {RANGES.map((range) => (
            <Chip
              key={range}
              label={range.toUpperCase()}
              selected={selectedRange === range}
              onPress={() => {}}
            />
          ))}
        </View>

        {/* Hero summary */}
        <Card style={styles.heroCard} elevation="md">
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>This week</Text>
              <Text style={styles.heroValue}>6-day streak</Text>
              <Text style={styles.heroSub}>Keep logging to extend your streak.</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>7D</Text>
            </View>
          </View>
        </Card>

        <View style={styles.summaryGrid}>
          {SUMMARY.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryDescription}>{item.description}</Text>
            </View>
          ))}
        </View>

        <Card style={[styles.chartCard, Shadows.soft]} elevation="none">
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Calories trend</Text>
            <Text style={styles.chartSubtitle}>Last {selectedRange}</Text>
          </View>
          <CalorieTrendChart data={TREND_DATA} />
        </Card>

        <Card style={styles.chartCard} elevation="sm">
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Macro balance</Text>
            <Text style={styles.chartSubtitle}>Prototype</Text>
          </View>
          <View style={styles.skeleton} />
          <Text style={styles.chartFootnote}>Protein / Carbs / Fat</Text>
        </Card>

        <Card style={styles.streakCard} elevation="sm">
          <View style={styles.streakHeader}>
            <Text style={styles.chartTitle}>Streaks</Text>
            <Text style={styles.chartSubtitle}>Past 14 days</Text>
          </View>
          <View style={styles.heatRow}>
            {Array.from({ length: 14 }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.heatCell,
                  idx < 6 ? styles.heatActive : styles.heatInactive,
                ]}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 28,
  },
  header: {
    gap: 8,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.bodySmall,
  },
  summaryGrid: {
    gap: 16,
  },
  summaryCard: {
    backgroundColor: DesignColors.surfaceHighlight,
    borderRadius: 22,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
  },
  summaryLabel: {
    ...Typography.label,
  },
  summaryValue: {
    fontSize: 24,
    color: DesignColors.black,
    fontWeight: '700',
  },
  summaryDescription: {
    ...Typography.bodySmall,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroCard: {
    gap: Spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    ...Typography.caption,
    color: DesignColors.gray600,
  },
  heroValue: {
    ...Typography.h2,
  },
  heroSub: {
    ...Typography.bodySmall,
    color: DesignColors.gray600,
  },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: DesignColors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DesignColors.primary,
  },
  heroBadgeText: {
    ...Typography.bodyBold,
    color: DesignColors.primaryDark,
  },
  chartCard: {
    gap: Spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitle: {
    ...Typography.bodyBold,
    color: DesignColors.black,
  },
  chartSubtitle: {
    ...Typography.caption,
    color: DesignColors.gray500,
  },
  chartFootnote: {
    ...Typography.caption,
    color: DesignColors.gray500,
    marginTop: Spacing.xs,
  },
  skeleton: {
    height: 80,
    borderRadius: 12,
    backgroundColor: DesignColors.gray100,
  },
  streakCard: {
    gap: Spacing.md,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heatRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  heatCell: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: DesignColors.gray200,
  },
  heatActive: {
    backgroundColor: DesignColors.primary,
  },
  heatInactive: {
    backgroundColor: DesignColors.gray200,
  },
  placeholderTitle: {
    fontSize: 18,
    color: DesignColors.white,
    fontWeight: '600',
  },
  placeholderCopy: {
    fontSize: 14,
    color: DesignColors.gray200,
    lineHeight: 20,
  },
});
