import { lookupFoodNutrition } from '@/services/nutritionLookup';
import { analyzeFoodImageAdvanced } from '@/services/advancedFoodAnalysis';
import { adjustBeverageUnits, detectSingleIngredient } from '@/services/advancedFoodEdgeCases';
import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { isBeverageName } from '@/services/foodNames';
import { validateAdvancedAnalysis } from '@/services/advancedFoodValidation';
import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';

jest.mock('@/services/photoAnalysis', () => ({ runPhotoAnalysis: jest.fn() }));
jest.mock('@/services/nutritionLookup', () => ({ lookupFoodNutrition: jest.fn() }));
const vision = runPhotoAnalysis as jest.Mock;
type VisibleIngredient = { name: string; weight_grams: number; confidence: number };
const food = (name: string, weight_grams: number, confidence = 90): VisibleIngredient => ({ name, weight_grams, confidence });
const region = (description: string, ingredients: VisibleIngredient[]) => ({ description, dishName: description, confidence: 90, ingredients });
const recognize = (regions: ReturnType<typeof region>[]) => vision.mockResolvedValueOnce(JSON.stringify({ regions, overallConfidence: 90, notes: '' }));

beforeEach(() => {
  vision.mockReset();
  (lookupFoodNutrition as jest.Mock).mockImplementation(async queries => queries.map((query: string) => {
    // Fixed provider fixtures isolate recognition/portion behavior from FatSecret search ranking.
    const calories: Record<string, number> = { 'scrambled eggs': 149, bread: 265, salmon: 208, chicken: 165 };
    return { query, candidates: [], match: query === 'orange juice' ? null : {
      id: 'fatsecret:fixture', name: query, source: 'fatsecret', basisAmount: 100, basisUnit: 'g', servings: [],
      nutrients: { calories: calories[query] ?? 100, protein: 10, carbs: 10, fat: 2 },
    } };
  }));

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('keeps a multi-ingredient egg plate and scales each visible quantity once', async () => {
  recognize([region('Scrambled eggs', [food('scrambled eggs', 160), food('bread', 80)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients.map(ingredient => [ingredient.name, ingredient.quantity])).toEqual([['scrambled eggs', 160], ['bread', 80]]);
  expect(result.data?.totalNutrition.calories).toBeCloseTo(450.4);
  expect(result.data?.ingredients[0].source).toBe('fatsecret');
  expect(result.data?.adjustments).toBeUndefined();
  expect(result.data?.warnings?.join(' ')).toContain('single-serving guideline');
});

it('keeps healthy nutrition and an incomplete subtotal when another ingredient lookup fails', async () => {
  recognize([region('Egg plate', [food('scrambled eggs', 160), food('bread', 80)])]);
  (lookupFoodNutrition as jest.Mock).mockResolvedValueOnce([
    { query: 'scrambled eggs', match: { id: 'fatsecret:1', name: 'Scrambled eggs', source: 'fatsecret', basisAmount: 100,
      basisUnit: 'g', servings: [], nutrients: { calories: 149, protein: 10, carbs: 10, fat: 2 } }, candidates: [] },
    { query: 'bread', match: null, candidates: [], reason: 'Nutrition service timed out. Try again shortly.',
      failure: { stage: 'details', code: 'timeout', retryable: true, attempts: 3 } },
  ]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.nutritionStatus).toBe('incomplete');
  expect(result.data?.ingredients[0].scaledNutrition?.calories).toBeCloseTo(238.4);
  expect(result.data?.ingredients[1]).toEqual(expect.objectContaining({ name: 'bread', quantity: 80,
    nutritionStatus: 'unresolved', nutrition: null, scaledNutrition: null, unresolvedReason: 'Nutrition service timed out. Try again shortly.' }));
  expect(result.data?.totalNutrition.calories).toBeCloseTo(238.4);
});

it('retains every reliable ingredient in a complex bowl', async () => {
  const names = ['chickpeas', 'bread', 'tomato', 'carrot', 'spinach', 'cheese', 'egg', 'garlic'];
  recognize([region('Mixed bowl', names.map(name => food(name, 20)))]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients.map(ingredient => ingredient.name)).toEqual(names);
  expect(result.data?.warnings?.join(' ')).toContain('Mixed dish');
});

it('preserves shared-pan amounts and small toppings', async () => {
  recognize([region('Fish pan', [food('salmon', 400), food('basil', 2)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients.map(ingredient => ingredient.quantity)).toEqual([400, 2]);
  expect(result.data?.ingredients[0].scaledNutrition?.calories).toBe(832);
});

it('does not inflate pizza crust or discard visible pepperoni', async () => {
  recognize([region('Pepperoni pizza', [food('pizza crust', 100), food('pepperoni', 30, 55), food('mozzarella', 30), food('basil', 2)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients.map(ingredient => ingredient.quantity)).toEqual([100, 30, 30, 2]);
  expect(vision).toHaveBeenCalledTimes(1);
});

it('retains the original analysis with a warning when optional topping refinement fails', async () => {
  recognize([region('Pizza', [food('pizza', 200), food('basil', 2)])]);
  vision.mockRejectedValueOnce(new Error('Refinement unavailable'));
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients).toHaveLength(2);
  expect(result.data?.warnings?.join(' ')).toContain('Topping refinement was unavailable');
  expect(vision).toHaveBeenCalledTimes(2);
});

it('does not double-count a repeated food within a region, but adds different regions', async () => {
  recognize([region('Chicken plate', [food('chicken', 100), food('chicken', 100)]), region('Second plate', [food('chicken', 120)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.data?.ingredients.map(ingredient => ingredient.quantity)).toEqual([100, 120]);
  expect(result.data?.totalNutrition.calories).toBeCloseTo(363);
  expect(result.metadata?.ingredientMergeLog).toBeDefined();
});

it('keeps steak in grams and preserves vision mass without inventing a volume conversion', async () => {
  recognize([region('Meal plate', [food('steak', 180), food('orange juice', 273)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.data?.ingredients.map(ingredient => [ingredient.unit, ingredient.quantity])).toEqual([['g', 180], ['g', 273]]);
  expect(result.data?.ingredients[1].nutritionStatus).toBe('unresolved');
});

it.each(['steak', 'milk chocolate', 'wine sauce', 'water chestnuts', 'coffee beans'])
('does not classify %s as a drink', name => {
  expect(isBeverageName(name)).toBe(false);
  expect(adjustBeverageUnits([{ name, quantity: 100, unit: 'g', confidence: 90 }])[0].unit).toBe('g');
});

it('recognizes an explicit whole ingredient without treating toast as one', () => {
  expect(detectSingleIngredient({ regions: [{ description: 'A whole apple', confidence: 90 }], overallConfidence: 90 })?.type).toBe('single_ingredient');
  expect(detectSingleIngredient({ regions: [{ description: 'Egg toast', confidence: 95 }], overallConfidence: 95 })).toBeNull();
});

it.each(['chocolate milk', 'iced tea', 'coffee', 'orange juice'])
('recognizes %s as a drink', name => {
  expect(isBeverageName(name)).toBe(true);
});

it.each([0, -1, NaN, Infinity])('refuses invalid ingredient weight %s', async weight => {
  recognize([region('Meal', [food('egg', weight)])]);
  expect((await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg')).success).toBe(false);
});

it('does not report an empty filtered analysis as successful', async () => {
  recognize([region('Meal', [food('egg', 50, 20)])]);
  expect((await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg')).success).toBe(false);
});

it('warns when excluding uncertain detections from an otherwise valid meal', async () => {
  recognize([region('Meal', [food('chicken', 100), food('rice', 100, 20)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients.map(ingredient => ingredient.name)).toEqual(['chicken']);
  expect(result.data?.warnings?.join(' ')).toContain('Uncertain detections excluded: rice');
});

it('returns failure rather than successful invalid nutrition', () => {
  const result: AdvancedAnalysisResult = { success: true, data: {
    confidence: 90, regions: [], ingredients: [],
    totalNutrition: { calories: NaN, protein: 10, carbs: 10, fat: 10 },
  } };
  const validated = validateAdvancedAnalysis(result);
  expect(validated.success).toBe(false);
  expect(validated.error).toContain('invalid');
});

it('never raises low confidence while applying validation penalties', () => {
  const result: AdvancedAnalysisResult = { success: true, data: {
    confidence: 10, regions: [], ingredients: [{ name: 'unknown food', quantity: 100, unit: 'g', confidence: 10, source: 'generic',
      nutrition: { foodId: 'generic_estimate', foodName: 'unknown food', calories: 100, protein: 5, carbs: 15, fat: 3, servingSize: '100 g', servingUnit: 'g' },
      scaledNutrition: { calories: 100, protein: 5, carbs: 15, fat: 3 } }],
    totalNutrition: { calories: 100, protein: 5, carbs: 15, fat: 3 },
  } };
  expect(validateAdvancedAnalysis(result).data?.confidence).toBeLessThanOrEqual(10);
});
