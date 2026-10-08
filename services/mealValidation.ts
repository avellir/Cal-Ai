import type { MealEditorErrors, MealEditorValues } from '@/lib/meal-draft-types';
import type { AddMealInput } from '@/lib/meal-log-types';
import { getLocalDateKey, parseLocalDateKey } from '@/lib/mealDates';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const NUMERIC_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'quantity'] as const;

function parseDecimal(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

export function getMealEditorValues(input: Partial<AddMealInput> = {}, dateKey?: string): MealEditorValues {
  const now = new Date();
  const loggedAt = input.loggedAt ? new Date(input.loggedAt) : now;
  const date = Number.isFinite(loggedAt.getTime()) ? loggedAt : now;
  return {
    name: input.name ?? '',
    calories: input.calories == null ? '' : String(input.calories),
    protein: input.macros?.protein == null ? '' : String(input.macros.protein),
    carbs: input.macros?.carbs == null ? '' : String(input.macros.carbs),
    fat: input.macros?.fat == null ? '' : String(input.macros.fat),
    quantity: String(input.quantity ?? 1),
    date: !input.loggedAt && dateKey && parseLocalDateKey(dateKey) ? dateKey : getLocalDateKey(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    mealType: input.mealType ?? 'snack',
  };
}

export function getLoggedAtForDate(dateKey?: string): string {
  const values = getMealEditorValues({}, dateKey);
  const result = validateMealEditor({ ...values, name: 'Meal', calories: '0', protein: '0', carbs: '0', fat: '0' });
  // A historical wall time can be skipped by DST. Use local noon as a safe fallback.
  if (result.success) return result.input.loggedAt!;
  const date = (dateKey && parseLocalDateKey(dateKey)) || new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

export function validateMealEditor(values: MealEditorValues, original: Partial<AddMealInput> = {}):
  { success: true; input: AddMealInput } | { success: false; errors: MealEditorErrors } {
  const errors: MealEditorErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Enter a meal name.';
  const numbers = Object.fromEntries(NUMERIC_FIELDS.map(field => [field, parseDecimal(values[field])])) as
    Record<typeof NUMERIC_FIELDS[number], number | null>;
  for (const field of NUMERIC_FIELDS) {
    if (numbers[field] === null) errors[field] = 'Enter a valid number (use 0 if none).';
  }
  if (numbers.quantity !== null && numbers.quantity <= 0) errors.quantity = 'Portion must be greater than zero.';
  if (numbers.quantity !== null && NUMERIC_FIELDS.some(field => field !== 'quantity' && numbers[field] !== null &&
    !Number.isFinite(numbers[field]! * numbers.quantity!))) {
    errors.quantity = 'This portion produces values that are too large.';
  }
  if (!(MEAL_TYPES as readonly string[]).includes(values.mealType)) errors.mealType = 'Choose a meal type.';
  const date = parseLocalDateKey(values.date.trim());
  if (!date) errors.date = 'Enter a valid date as YYYY-MM-DD.';
  const time = /^(\d{2}):(\d{2})$/.exec(values.time.trim());
  const hours = time ? Number(time[1]) : -1;
  const minutes = time ? Number(time[2]) : -1;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    errors.time = 'Enter a valid time as HH:MM (24-hour).';
  } else if (date) {
    date.setHours(hours, minutes, 0, 0);
    if (date.getHours() !== hours || date.getMinutes() !== minutes || getLocalDateKey(date) !== values.date.trim()) {
      errors.time = 'This time does not exist on that date. Choose another time.';
    }
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    input: {
      ...original,
      name,
      calories: numbers.calories!,
      macros: { protein: numbers.protein!, carbs: numbers.carbs!, fat: numbers.fat! },
      quantity: numbers.quantity!,
      loggedAt: date!.toISOString(),
      mealType: values.mealType,
    },
  };
}

/** Validate typed input again at the persistence boundary, including non-UI callers. */
export function getMealInputError(input: AddMealInput): string | null {
  if (!input.name.trim()) return 'Meal name is required.';
  const quantity = input.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Meal quantity must be a positive finite number.';
  const nutrition = [input.calories, input.macros.protein, input.macros.carbs, input.macros.fat];
  if (nutrition.some(value => !Number.isFinite(value) || value < 0 || !Number.isFinite(value * quantity))) {
    return 'Meal nutrition must contain nonnegative finite numbers.';
  }
  if (input.mealType && !(MEAL_TYPES as readonly string[]).includes(input.mealType)) return 'Invalid meal type.';
  if (input.loggedAt && !Number.isFinite(new Date(input.loggedAt).getTime())) return 'Invalid meal date.';
  return null;
}
