import { scaleNutrition } from '@/services/localNutrition';
import { recalculateAnalysis, resolveIngredient, unresolvedIngredient, hasCompleteNutrition } from '@/services/analysisNutrition';
import { validateAdvancedAnalysis } from '@/services/advancedFoodValidation';
import type { NutritionReference } from '@/lib/nutrition-types';

const reference: NutritionReference = {
  id: 'fatsecret:fixture', name: 'Cooked food', source: 'fatsecret', basisAmount: 100, basisUnit: 'g',
  nutrients: { calories: 149, protein: 9.99, carbs: 1.61, fat: 10.98 },
  servings: [{ name: '1 piece', grams: 50 }],
};

it('scales source values once without rounding individual ingredients', () => {
  expect(scaleNutrition(reference, 160, 'g').calories).toBeCloseTo(238.4);
  expect(scaleNutrition(reference, 0.16, 'kg')).toEqual(scaleNutrition(reference, 160, 'g'));
  expect(scaleNutrition(reference, 2, 'serving', 0)).toEqual(reference.nutrients);
});
it.each([0, -1, NaN, Infinity])('rejects invalid amount %s', amount => {
  expect(() => scaleNutrition(reference, amount, 'g')).toThrow('positive finite');
});
it('requires a known serving weight and refuses implicit density conversions', () => {
  expect(() => scaleNutrition(reference, 200, 'ml')).toThrow('Volume');
  expect(() => scaleNutrition(reference, 1, 'serving')).toThrow();
  expect(() => scaleNutrition(reference, 1, 'piece')).toThrow();
});
it('supports explicitly entered volume nutrition', () => {
  expect(scaleNutrition({ ...reference, basisUnit: 'ml' }, 200, 'ml').calories).toBe(298);
});
it('preserves unknown nutrition as null and a zero known subtotal as a reviewable success', () => {
  const unknown = unresolvedIngredient({ name: 'unknown sauce', quantity: 160, unit: 'g', confidence: 90 }, 'Choose a recipe');
  const data = recalculateAnalysis({ totalNutrition: reference.nutrients, ingredients: [], regions: [], confidence: 90 }, [unknown]);
  expect(unknown.nutrition).toBeNull();
  expect(data.totalNutrition.calories).toBe(0);
  expect(hasCompleteNutrition(data)).toBe(false);
  expect(validateAdvancedAnalysis({ success: true, data }).success).toBe(true);
});
it('aggregates only matched foods and becomes complete after the unknown is corrected', () => {
  const base = { totalNutrition: reference.nutrients, ingredients: [], regions: [], confidence: 90 };
  const known = resolveIngredient({ name: 'egg', quantity: 100, unit: 'g', confidence: 90 }, reference);
  const unknown = unresolvedIngredient({ name: 'sauce', quantity: 50, unit: 'g', confidence: 80 }, 'Choose a sauce');
  const partial = recalculateAnalysis(base, [known, unknown]);
  expect(partial.totalNutrition).toEqual(reference.nutrients);
  expect(partial.nutritionStatus).toBe('incomplete');
  expect(recalculateAnalysis(base, [known, resolveIngredient({ ...unknown, quantitySource: 'user' }, reference)]).nutritionStatus).toBe('complete');
});
