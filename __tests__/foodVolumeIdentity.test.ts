import { analyzeFoodImageAdvanced } from '@/services/advancedFoodAnalysis';
import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { lookupFoodNutrition, isNutritionReference } from '@/services/nutritionLookup';
import { ingredientFromVision } from '@/services/photoMeasurements';
import { scaleNutrition } from '@/services/localNutrition';
import { correctIngredientAmount, resolveIngredient, unresolvedIngredient } from '@/services/analysisNutrition';
import { addAnalysisFat, confirmAnalysisFat, confirmAnalysisRegion, hasPendingAnalysisReview, initializeAnalysisScope } from '@/services/analysisScope';
import { getAnalysisServingSizeLabel, getMealInputFromAnalysis, isSuccessfulAnalysisData } from '@/services/foodAnalysis';
import type { NutritionReference } from '@/lib/nutrition-types';
import { useMealDraftStore } from '@/store/mealDraftStore';
jest.mock('@/services/photoAnalysis', () => ({ runPhotoAnalysis: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/services/nutritionLookup', () => ({ ...jest.requireActual('@/services/nutritionLookup'), lookupFoodNutrition: jest.fn() }));

const reference: NutritionReference = { id: 'fatsecret:1', name: 'Tea', source: 'fatsecret', basisAmount: 100, basisUnit: 'g',
  nutrients: { calories: 50, protein: 2, carbs: 8, fat: 1 }, servings: [{ name: '100 ml', grams: 104, volumeMl: 100 }] };
const item = (name: string, amount: number, unit: 'g' | 'ml', extra = {}) => ({
  name, food_name: name, amount, unit, amount_min: amount * 0.8, amount_max: amount * 1.2, confidence: 90, ...extra,
});
beforeEach(() => {
  jest.clearAllMocks();
  useMealDraftStore.getState().reset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  (lookupFoodNutrition as jest.Mock).mockImplementation(async queries => queries.map((query: string) => ({ query, match: reference })));
});
afterEach(() => jest.restoreAllMocks());

it('reads modern ml and legacy g without relabelling units or losing the original range', () => {
  const modern = ingredientFromVision(item('tea', 220, 'ml'), 0);
  expect(modern.unit).toBe('ml');
  expect(modern.estimatedAmountRange).toEqual({ min: 176, max: 264, unit: 'ml' });
  expect(modern.estimatedWeightRange).toBeUndefined();
  expect(ingredientFromVision({ name: 'tea', weight_grams: 220, confidence: 90 }, 0).unit).toBe('g');
  const corrected = correctIngredientAmount(unresolvedIngredient(modern, ''), 150, 'g');
  expect(corrected.originalEstimate).toEqual({ quantity: 220, unit: 'ml' });
  expect(corrected.photoAmountRange?.unit).toBe('ml');
  expect(corrected.estimatedAmountRange).toBeUndefined();
});

it('uses only documented serving volume/mass for scaling and validates optional volume data', () => {
  expect(scaleNutrition(reference, 200, 'ml').calories).toBe(104);
  expect(scaleNutrition({ ...reference, basisUnit: 'ml', servings: [] }, 200, 'ml').calories).toBe(100);
  expect(() => scaleNutrition({ ...reference, servings: [{ name: 'cup', grams: 240 }] }, 200, 'ml')).toThrow('Volume');
  expect(isNutritionReference(reference)).toBe(true);
  expect(isNutritionReference({ ...reference, servings: [{ name: 'ml', grams: 104, volumeMl: -1 }] })).toBe(false);
});

it('preserves drink volume and garnish mass through lookup, route serialization and draft saving', async () => {
  (runPhotoAnalysis as jest.Mock).mockResolvedValueOnce(JSON.stringify({ overallConfidence: 90, regions: [{ description: 'Tea', dishName: 'Tea', scope: 'main', confidence: 90,
    ingredients: [item('tea', 200, 'ml'), item('lemon', 5, 'g')] }] }));
  const result = await analyzeFoodImageAdvanced('photo', 'jpeg');
  expect(result.success).toBe(true);
  const data = result.data!;
  expect(data.ingredients.map(ingredient => ingredient.unit)).toEqual(['ml', 'g']);
  expect(getAnalysisServingSizeLabel(data)).toBe('5g + 200ml');
  expect(isSuccessfulAnalysisData(JSON.parse(JSON.stringify(data)))).toBe(true);
  const input = getMealInputFromAnalysis(data, 0.5);
  const id = useMealDraftStore.getState().createDraft('user', input, result);
  expect(useMealDraftStore.getState().drafts[id].originalAnalysis?.data?.ingredients[0].originalEstimate?.unit).toBe('ml');
  expect(input.quantity).toBe(0.5);
  expect(lookupFoodNutrition).toHaveBeenCalledWith(['tea', 'lemon'], expect.arrayContaining([expect.objectContaining({ unit: 'ml' })]));
});

it('does not apply a guessed recipe even if lookup returns one for unknown cocktail composition', async () => {
  (runPhotoAnalysis as jest.Mock).mockResolvedValueOnce(JSON.stringify({ overallConfidence: 90, regions: [{ description: 'Cocktail', confidence: 90, scope: 'main',
    ingredients: [item('cocktail', 220, 'ml', { nutrition_identity_known: false, identity_uncertain: true, identity_alternatives: ['alcoholic cocktail', 'mocktail'] })] }] }));
  const result = await analyzeFoodImageAdvanced('photo', 'jpeg');
  expect(result.data?.ingredients[0].nutritionStatus).toBe('unresolved');
  expect(result.data?.ingredients[0].unit).toBe('ml');
  expect(result.data?.totalNutrition.calories).toBe(0);
  expect(result.data?.ingredients[0].identityAlternatives).toHaveLength(2);
});

it('requires a separate fat decision, adds no automatic spoon and permits explicit user-entered fat', () => {
  const ingredients = [resolveIngredient({ name: 'salad', quantity: 200, unit: 'g', confidence: 90, regionIndex: 0 }, reference)];
  const data = initializeAnalysisScope({ totalNutrition: reference.nutrients, ingredients, confidence: 90,
    regions: [{ description: 'Salad', confidence: 90, scope: 'main', fatAssessment: 'ambiguous', fatEvidence: 'Possible drizzle' }] });
  expect(data.ingredients).toHaveLength(1);
  expect(hasPendingAnalysisReview(confirmAnalysisRegion(data, 0))).toBe(true);
  expect(hasPendingAnalysisReview(confirmAnalysisFat(data, 0))).toBe(false);
  const oil = resolveIngredient({ name: 'oil', quantity: 8, unit: 'g', quantitySource: 'user', confidence: 100 }, reference);
  const added = addAnalysisFat(data, 0, oil);
  expect(added.ingredients).toHaveLength(2);
  expect(added.ingredients[1].quantity).toBe(8);
  expect(hasPendingAnalysisReview(added)).toBe(false);
});

it('does not flag a documented extra topping as an internal component of a whole dish', () => {
  const base = { name: 'cheesecake', quantity: 100, unit: 'g', confidence: 90, regionIndex: 0 };
  const data = initializeAnalysisScope({ totalNutrition: reference.nutrients, confidence: 90,
    ingredients: [unresolvedIngredient({ ...base, representation: 'whole_dish' }, ''), unresolvedIngredient({ ...base, name: 'berries', representation: 'component', extraWithWholeDish: true }, '')],
    regions: [{ description: 'Cake', confidence: 90, scope: 'main', fatAssessment: 'included_in_dish' }] });
  expect(data.regions[0].reviewReasons).toEqual([]);
});
