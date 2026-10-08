import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MealTypePicker } from '@/components/meal-log/MealTypePicker';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';
import type { MealEditorValues } from '@/lib/meal-draft-types';
import type { AddMealInput } from '@/lib/meal-log-types';
import { getLocalDateKey } from '@/lib/mealDates';
import { getMealEditorValues, validateMealEditor } from '@/services/mealValidation';

type MealEditorProps = {
  initialInput?: Partial<AddMealInput>;
  dateKey?: string;
  onSubmit: (input: AddMealInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
};

const NUTRITION_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
] as const;

/** Reusable form: values are base-serving nutrition, never pre-scaled totals. */
export function MealEditor({ initialInput, dateKey, onSubmit, onCancel, isSubmitting = false, submitLabel = 'Apply changes' }: MealEditorProps) {
  const [values, setValues] = useState(() => getMealEditorValues(initialInput, dateKey));
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const result = validateMealEditor(values, initialInput);
  const errors = hasSubmitted && !result.success ? result.errors : {};
  const setField = <K extends keyof MealEditorValues>(field: K, value: MealEditorValues[K]) =>
    setValues(current => ({ ...current, [field]: value }));

  const field = (key: Exclude<keyof MealEditorValues, 'mealType'>, label: string, placeholder: string, numeric = false, compact = false) => (
    <View key={key} style={[styles.field, compact && styles.compactField]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={values[key]}
        onChangeText={value => setField(key, value)}
        placeholder={placeholder}
        placeholderTextColor={DesignColors.gray500}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize={key === 'name' ? 'sentences' : 'none'}
        autoCorrect={key === 'name'}
        editable={!isSubmitting}
        style={[styles.input, errors[key] && styles.inputError]}
      />
      {errors[key] ? <Text accessibilityRole="alert" style={styles.error}>{errors[key]}</Text> : null}
    </View>
  );

  const submit = () => {
    if (isSubmitting) return;
    setHasSubmitted(true);
    if (result.success) onSubmit(result.input);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal details</Text>
        <Pressable accessibilityRole="button" onPress={onCancel} disabled={isSubmitting} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {field('name', 'Meal name', 'e.g. Chicken and rice')}
        <Card elevation="none">
          <Text style={styles.sectionTitle}>Nutrition per base portion</Text>
          <Text style={styles.hint}>Enter values for one portion. The portion multiplier below applies once.</Text>
          {initialInput?.servingSizeLabel ? <Text style={styles.hint}>Base portion: {initialInput.servingSizeLabel}</Text> : null}
          <View style={styles.nutritionGrid}>
            {NUTRITION_FIELDS.map(item => field(item.key, `${item.label} (${item.unit})`, '0', true, true))}
          </View>
        </Card>
        {field('quantity', 'Portion multiplier', '1', true)}
        <View style={styles.quickChoices}>
          {[0.5, 1, 1.5, 2].map(quantity => (
            <Chip key={quantity} label={`${quantity}×`} selected={Number(values.quantity.replace(',', '.')) === quantity}
              disabled={isSubmitting} onPress={() => setField('quantity', String(quantity))} />
          ))}
        </View>
        <Text style={styles.label}>Meal type</Text>
        <MealTypePicker value={values.mealType} disabled={isSubmitting} onChange={value => setField('mealType', value)} />
        {errors.mealType ? <Text accessibilityRole="alert" style={styles.error}>{errors.mealType}</Text> : null}
        <View style={styles.dateTime}>
          {field('date', 'Date (YYYY-MM-DD)', '2026-10-01', false, true)}
          {field('time', 'Time (HH:MM)', '12:30', false, true)}
        </View>
        <View style={styles.quickChoices}>
          <Chip label="Today" disabled={isSubmitting} onPress={() => setField('date', getLocalDateKey())} />
          <Chip label="Yesterday" disabled={isSubmitting} onPress={() => {
            const date = new Date();
            date.setDate(date.getDate() - 1);
            setField('date', getLocalDateKey(date));
          }} />
        </View>
        <Text style={styles.hint}>Date and time use your device&apos;s timezone.</Text>
        {result.success ? (
          <Card elevation="none" backgroundColor={DesignColors.primaryBg}>
            <Text style={styles.sectionTitle}>Selected portion</Text>
            <Text style={styles.total}>{Math.round(result.input.calories * result.input.quantity!)} calories</Text>
            <Text style={styles.hint}>
              Protein {Math.round(result.input.macros.protein * result.input.quantity!)}g · Carbs {Math.round(result.input.macros.carbs * result.input.quantity!)}g · Fat {Math.round(result.input.macros.fat * result.input.quantity!)}g
            </Text>
          </Card>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting }} onPress={submit}
          disabled={isSubmitting} style={[styles.submit, isSubmitting && styles.disabled]}>
          {isSubmitting ? <ActivityIndicator color={DesignColors.white} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DesignColors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  title: { ...Typography.h3, color: DesignColors.black },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  cancelText: { ...Typography.body, color: DesignColors.primary },
  content: { padding: Spacing.lg, gap: Spacing.md },
  field: { gap: Spacing.xs },
  compactField: { flexGrow: 1, flexBasis: '45%' },
  label: { ...Typography.bodySmallBold, color: DesignColors.black },
  input: { ...Typography.body, minHeight: 48, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: DesignColors.gray300, borderRadius: BorderRadius.md, color: DesignColors.black, backgroundColor: DesignColors.white },
  inputError: { borderColor: DesignColors.error },
  error: { ...Typography.caption, color: DesignColors.errorRedDark },
  sectionTitle: { ...Typography.bodyBold, color: DesignColors.black },
  hint: { ...Typography.bodySmall, color: DesignColors.gray600, marginTop: Spacing.xs },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md },
  dateTime: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  quickChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  total: { ...Typography.h3, color: DesignColors.black, marginTop: Spacing.sm },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: DesignColors.gray200 },
  submit: { minHeight: 50, borderRadius: BorderRadius.md, backgroundColor: DesignColors.black, alignItems: 'center', justifyContent: 'center' },
  submitText: { ...Typography.bodyBold, color: DesignColors.white },
  disabled: { opacity: 0.5 },
});
