import { analyzeFoodImageAdvanced } from '@/services/advancedFoodAnalysis';
import { adjustBeverageUnits, detectSingleIngredient } from '@/services/advancedFoodEdgeCases';
import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { isBeverageName } from '@/services/foodNames';
import { validateAdvancedAnalysis } from '@/services/advancedFoodValidation';
import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';

jest.mock('@/services/photoAnalysis', () => ({ runPhotoAnalysis: jest.fn() }));
const vision = runPhotoAnalysis as jest.Mock;
type VisibleIngredient = { name: string; weight_grams: number; confidence: number };
const food = (name: string, weight_grams: number, confidence = 90): VisibleIngredient => ({ name, weight_grams, confidence });
const region = (description: string, ingredients: VisibleIngredient[]) => ({ description, dishName: description, confidence: 90, ingredients });
const recognize = (regions: ReturnType<typeof region>[]) => vision.mockResolvedValueOnce(JSON.stringify({ regions, overallConfidence: 90, notes: '' }));

beforeEach(() => {
  vision.mockReset();
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
  expect(result.data?.totalNutrition.calories).toBe(450);
  expect(result.data?.ingredients[0].source).toBe('estimated');
  expect(result.data?.adjustments).toBeUndefined();
  expect(result.data?.warnings?.join(' ')).toContain('single-serving guideline');
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
  expect(result.data?.ingredients[0].scaledNutrition.calories).toBe(832);
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
  expect(result.data?.ingredients[0].quantity).toBe(220);
  expect(result.data?.totalNutrition.calories).toBe(363);
  expect(result.metadata?.ingredientMergeLog).toBeDefined();
});

it('keeps steak in grams and preserves the supplied beverage quantity in ml', async () => {
  recognize([region('Meal plate', [food('steak', 180), food('orange juice', 273)])]);
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.data?.ingredients.map(ingredient => [ingredient.unit, ingredient.quantity])).toEqual([['g', 180], ['ml', 273]]);
  expect(result.data?.ingredients[1].source).toBe('generic');
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
