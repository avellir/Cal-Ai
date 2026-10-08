import type { MealEditorValues } from '@/lib/meal-draft-types';
import type { AddMealInput } from '@/lib/meal-log-types';
import { getLocalDateKey } from '@/lib/mealDates';
import { getLoggedAtForDate, getMealEditorValues, getMealInputError, validateMealEditor } from '@/services/mealValidation';

const input: AddMealInput = {
  name: 'Chicken bowl', calories: 500.5, macros: { protein: 30.5, carbs: 60.25, fat: 15.75 },
  quantity: 2, servingSizeLabel: '400g', imageUri: 'file://meal.jpg',
  loggedAt: new Date(2026, 8, 30, 12, 30).toISOString(), mealType: 'lunch',
};

describe('shared meal editor validation', () => {
  it('round-trips base nutrition, fraction precision, units, image, type and local time without scaling twice', () => {
    const values = getMealEditorValues(input);
    expect(values.date).toBe('2026-09-30');
    expect(values.time).toBe('12:30');
    expect(validateMealEditor(values, input)).toEqual({ success: true, input });
  });

  it('requires explicit nutrition for manual meals, while accepting zero macros', () => {
    const blank = getMealEditorValues();
    const result = validateMealEditor(blank);
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['name', 'calories', 'protein', 'carbs', 'fat']));
    expect(validateMealEditor({ ...blank, name: 'Water', calories: '0', protein: '0', carbs: '0', fat: '0' }).success).toBe(true);
  });

  it('supports decimal commas and trims the name without altering base units', () => {
    const result = validateMealEditor({ ...getMealEditorValues(input), name: '  Dinner  ', calories: '250,5', quantity: '1,5' }, input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.input.name).toBe('Dinner');
      expect(result.input.calories).toBe(250.5);
      expect(result.input.quantity).toBe(1.5);
      expect(result.input.servingSizeLabel).toBe('400g');
    }
  });

  it.each(['', ' ', '-1', 'NaN', 'Infinity', '12abc', '0x10', '1e3', '1,2,3'])('rejects invalid nutrition text %s', value => {
    const result = validateMealEditor({ ...getMealEditorValues(input), calories: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.calories).toBeDefined();
  });

  it.each(['0', '-1', 'Infinity'])('rejects nonpositive or invalid portions %s', quantity => {
    expect(validateMealEditor({ ...getMealEditorValues(input), quantity }).success).toBe(false);
  });

  it.each([
    { date: '2026-02-29' }, { date: '2026-13-01' }, { time: '24:00' }, { time: '12:60' },
    { mealType: 'other' as MealEditorValues['mealType'] },
  ])('rejects invalid calendar/time/type values %s', change => {
    expect(validateMealEditor({ ...getMealEditorValues(input), ...change }).success).toBe(false);
  });

  it('initializes scans on the selected historical day and keeps explicit saved timestamps', () => {
    expect(getLocalDateKey(new Date(getLoggedAtForDate('2026-09-25')))).toBe('2026-09-25');
    expect(getMealEditorValues(input, '2026-09-25').date).toBe('2026-09-30');
  });

  it('rejects values that overflow after multiplying by portion', () => {
    const result = validateMealEditor({ ...getMealEditorValues(input), calories: '9'.repeat(308), quantity: '2' });
    expect(result.success).toBe(false);
    expect(getMealInputError({ ...input, calories: Number.MAX_VALUE, quantity: 2 })).toBeDefined();
  });

  it('revalidates direct service callers for invalid nutrition, date and type', () => {
    expect(getMealInputError(input)).toBeNull();
    expect(getMealInputError({ ...input, macros: { ...input.macros, fat: -1 } })).toBeDefined();
    expect(getMealInputError({ ...input, loggedAt: 'invalid' })).toBeDefined();
    expect(getMealInputError({ ...input, mealType: 'other' as AddMealInput['mealType'] })).toBeDefined();
  });
});
