import { correctIngredientAmount, resolveIngredient, unresolvedIngredient, recalculateAnalysis, replaceAnalysisIngredient, isWholeDishReference } from '@/services/analysisNutrition';
import { getMealInputFromAnalysis, isSuccessfulAnalysisData } from '@/services/foodAnalysis';
import { getMealInputError } from '@/services/mealValidation';
import { useMealDraftStore } from '@/store/mealDraftStore';
import type { NutritionReference } from '@/lib/nutrition-types';

const reference: NutritionReference = {
  id: 'usda:fixture', name: 'Prepared borscht soup', source: 'usda', basisAmount: 100, basisUnit: 'g',
  nutrients: { calories: 50, protein: 2, carbs: 7, fat: 1.5 }, servings: [{ name: '1 bowl', grams: 300 }], recipeAverage: true,
};
const visible = (name: string, quantity: number, regionIndex: number) => ({
  name, quantity, unit: 'g', confidence: 90, regionIndex, quantitySource: 'photo' as const,
});
const base = { ingredients: [], regions: [], confidence: 90, totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 } };

beforeEach(() => useMealDraftStore.getState().reset());

it('keeps the soup unresolved without adding guessed nutrition and preserves all visible foods', () => {
  const data = recalculateAnalysis(base, [
    unresolvedIngredient(visible('tomato broth', 320, 0), 'Choose the recipe'),
    resolveIngredient(visible('potatoes', 90, 0), reference),
    unresolvedIngredient(visible('rice cake', 18, 1), 'Choose crispbread'),
  ]);
  expect(isSuccessfulAnalysisData(JSON.parse(JSON.stringify(data)))).toBe(true);
  expect(data.totalNutrition.calories).toBe(45);
  expect(getMealInputError(getMealInputFromAnalysis(data, 1))).toContain('missing nutrition');
});
it('replaces a complete borscht recipe and its components while preserving a separate rice cake', () => {
  const items = [
    unresolvedIngredient(visible('tomato broth', 320, 0), ''),
    unresolvedIngredient(visible('potatoes', 90, 0), ''),
    unresolvedIngredient(visible('onions', 50, 0), ''),
    resolveIngredient(visible('rice cake', 18, 1), reference),
  ];
  const replacement = resolveIngredient(visible('borscht', 460, 0), reference);
  const data = replaceAnalysisIngredient(recalculateAnalysis(base, items), 0, replacement, true);
  expect(data.ingredients.map(item => item.name)).toEqual(['borscht', 'rice cake']);
  expect(data.totalNutrition.calories).toBeCloseTo(239);
  expect(isWholeDishReference(reference)).toBe(true);
  expect(isWholeDishReference({ ...reference, name: 'Tomato broth' })).toBe(false);
});
it('preserves the original estimate and recalculates corrected grams or documented servings', () => {
  const ingredient = resolveIngredient(visible('pancakes', 300, 0), reference);
  const corrected = correctIngredientAmount(ingredient, 150, 'g');
  expect(corrected.originalEstimate).toEqual({ quantity: 300, unit: 'g' });
  expect(corrected.quantitySource).toBe('user');
  expect(corrected.scaledNutrition?.calories).toBe(75);
  expect(correctIngredientAmount(corrected, 2, 'serving', 0).scaledNutrition?.calories).toBe(300);
});
it('retains corrected analysis through navigation without overwriting the original photo estimate', () => {
  const data = recalculateAnalysis(base, [resolveIngredient(visible('pancakes', 300, 0), reference)]);
  const original = { success: true, data };
  const input = getMealInputFromAnalysis(data, 2, 'file:///photo.jpg', { loggedAt: '2026-10-08T10:00:00Z', mealType: 'lunch' });
  const id = useMealDraftStore.getState().createDraft('user', input, original);
  const next = recalculateAnalysis(data, [correctIngredientAmount(data.ingredients[0], 150, 'g')]);
  expect(useMealDraftStore.getState().updateAnalysis('user', id, { success: true, data: next })).toBe(true);
  const draft = useMealDraftStore.getState().drafts[id];
  expect(draft.originalAnalysis?.data?.totalNutrition.calories).toBe(150);
  expect(draft.currentAnalysis?.data?.totalNutrition.calories).toBe(75);
  expect(draft.input.quantity).toBe(2);
  expect(draft.input.calories * draft.input.quantity!).toBe(150);
  expect(draft.input.mealType).toBe('lunch');
  expect(useMealDraftStore.getState().updateAnalysis('other-user', id, original)).toBe(false);
});
it('allows incomplete drafts for correction but requires explicit complete nutrition at persistence', () => {
  const data = recalculateAnalysis(base, [unresolvedIngredient(visible('unknown sauce', 100, 0), 'Choose sauce')]);
  const input = getMealInputFromAnalysis(data, 0.5);
  const id = useMealDraftStore.getState().createDraft('user', input, { success: true, data });
  expect(getMealInputError(input)).toContain('missing nutrition');
  const override = { ...input, nutritionStatus: 'complete' as const, calories: 500, macros: { protein: 20, carbs: 50, fat: 24 } };
  expect(useMealDraftStore.getState().updateDraft('user', id, override)).toBe(true);
  expect(useMealDraftStore.getState().drafts[id].nutritionOverride?.calories).toBe(500);
  expect(getMealInputError(override)).toBeNull();
  const correction = recalculateAnalysis(data, [resolveIngredient(data.ingredients[0], reference)]);
  useMealDraftStore.getState().updateAnalysis('user', id, { success: true, data: correction });
  expect(useMealDraftStore.getState().drafts[id].nutritionOverride).toBeUndefined();
});
it('keeps unresolved curry sauce while aggregating shrimp and vegetables', () => {
  const data = recalculateAnalysis(base, [
    resolveIngredient(visible('shrimp', 120, 0), reference),
    resolveIngredient(visible('carrot', 90, 0), reference),
    unresolvedIngredient(visible('curry sauce', 100, 0), 'Choose the recipe'),
  ]);
  expect(data.nutritionStatus).toBe('incomplete');
  expect(data.ingredients[2].scaledNutrition).toBeNull();
  expect(data.totalNutrition.calories).toBe(105);
});
