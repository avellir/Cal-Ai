import { View, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Spacing } from '@/constants/theme';
import type { MealType } from '@/lib/meal-log-types';

const OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function MealTypePicker({ value, onChange, disabled = false }: {
  value: MealType;
  onChange: (value: MealType) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.options} accessibilityLabel="Meal type">
      {OPTIONS.map(option => (
        <Chip key={option.value} label={option.label} selected={value === option.value}
          disabled={disabled} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm } });
