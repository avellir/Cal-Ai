import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const SUMMARY = [
  { label: 'Current streak', value: '6 days', description: 'You logged meals every day this week.' },
  { label: 'Average calories', value: '2,180 kcal', description: 'Within your weekly target of 2,250 kcal.' },
  { label: 'Water intake', value: '82 oz', description: 'Only 6 oz away from your hydration goal.' },
];

export default function ProgressScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress overview</Text>
          <Text style={styles.subtitle}>
            Keep up the momentum by reviewing the trends from your recent logs.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          {SUMMARY.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryDescription}>{item.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>Charts coming soon</Text>
          <Text style={styles.placeholderCopy}>
            We&apos;ll plug in visual analytics once tracking is ready. For now, these cards preview
            the type of insights you&apos;ll find here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    fontSize: 26,
    color: '#11181C',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  summaryGrid: {
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#F7F6FB',
    borderRadius: 22,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECECF2',
  },
  summaryLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 24,
    color: '#11181C',
    fontWeight: '700',
  },
  summaryDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  placeholder: {
    backgroundColor: '#11181C',
    borderRadius: 24,
    padding: 24,
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  placeholderCopy: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
});
