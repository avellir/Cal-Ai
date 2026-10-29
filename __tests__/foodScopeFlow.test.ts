import { analyzeFoodImageAdvanced } from '@/services/advancedFoodAnalysis';
import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { lookupFoodNutrition } from '@/services/nutritionLookup';
import { confirmAnalysisRegion, hasPendingAnalysisReview, selectAnalysisRegion } from '@/services/analysisScope';
import { correctIngredientAmount, recalculateAnalysis } from '@/services/analysisNutrition';
import { getMealInputFromAnalysis, isSuccessfulAnalysisData } from '@/services/foodAnalysis';
import { useMealDraftStore } from '@/store/mealDraftStore';
jest.mock('@/services/photoAnalysis', () => ({ runPhotoAnalysis: jest.fn() }));
jest.mock('@/services/nutritionLookup', () => ({ lookupFoodNutrition: jest.fn() }));

const food = (name: string, weight_grams: number, extra = {}) => ({ name, weight_grams, confidence: 90, representation: 'component', ...extra });
const region = (dishName: string, ingredients: ReturnType<typeof food>[], extra = {}) => ({ dishName, description: dishName, confidence: 90, ingredients, scope: 'main', ...extra });
async function analyze(regions: ReturnType<typeof region>[]) {
  (runPhotoAnalysis as jest.Mock).mockResolvedValueOnce(JSON.stringify({ regions, overallConfidence: 90 }));
  const result = await analyzeFoodImageAdvanced('photo', 'jpeg');
  expect(result.success).toBe(true);
  return result.data!;
}
beforeEach(() => {
  jest.resetAllMocks();
  useMealDraftStore.getState().reset();
  (lookupFoodNutrition as jest.Mock).mockImplementation(async queries => queries.map((query: string) => ({ query, match: {
    id: 'fatsecret:fixture', name: query, source: 'fatsecret', basisAmount: 100, basisUnit: 'g',
    nutrients: { calories: 100, protein: 10, carbs: 10, fat: 2 }, servings: [],
  } })));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('selects the main plate and keeps optional tea/background toast out of totals and display names', async () => {
  const data = await analyze([region('Egg plate', [food('fried egg', 50)]),
    region('Tea', [food('tea', 200)], { scope: 'accompaniment' }), region('Jam toast', [food('jam bread', 48)], { scope: 'background' })]);
  expect(data.totalNutrition.calories).toBe(50);
  expect(data.excludedIngredients).toHaveLength(2);
  expect(getMealInputFromAnalysis(data, 1).name).toBe('Egg plate');
  const included = selectAnalysisRegion(data, 1, true);
  expect(included.totalNutrition.calories).toBe(250);
  const corrected = recalculateAnalysis(included, included.ingredients.map(item => item.name === 'tea' ? correctIngredientAmount(item, 150, 'g') : item));
  const restored = selectAnalysisRegion(selectAnalysisRegion(corrected, 1, false), 1, true);
  expect(restored.ingredients.find(item => item.name === 'tea')?.quantity).toBe(150);
  expect(isSuccessfulAnalysisData(JSON.parse(JSON.stringify(restored)))).toBe(true);
});

it('preserves a half avocado and two quail eggs as total masses without multiplying counts or fractions again', async () => {
  const data = await analyze([region('Bowl', [food('avocado', 85, { visible_count: 1, visible_fraction: 0.5, item_type: 'avocado' }),
    food('quail eggs', 18, { visible_count: 2, visible_fraction: 1, item_type: 'quail egg' })])]);
  expect(data.totalNutrition.calories).toBe(103);
  expect(data.ingredients[0]).toEqual(expect.objectContaining({ quantity: 85, visibleCount: 1, visibleFraction: 0.5, representation: 'component' }));
  expect(data.ingredients[1].itemType).toBe('quail egg');
  const corrected = correctIngredientAmount(data.ingredients[0], 80, 'g');
  expect(corrected.originalEstimate).toEqual({ quantity: 85, unit: 'g' });
  expect(corrected.visibleFraction).toBe(0.5);
  expect(corrected.estimatedWeightRange).toBeUndefined();
});

it('requires shared-pan portion confirmation and keeps it through the draft', async () => {
  const data = await analyze([region('Salmon pan', [food('salmon', 400)], { serving_confirmation_required: true })]);
  expect(hasPendingAnalysisReview(data)).toBe(true);
  expect(getMealInputFromAnalysis(data, 0.5).nutritionStatus).toBe('incomplete');
  const confirmed = confirmAnalysisRegion(data, 0);
  expect(hasPendingAnalysisReview(confirmed)).toBe(false);
  const input = getMealInputFromAnalysis(confirmed, 0.5);
  expect(input.calories).toBe(400);
  expect(input.quantity).toBe(0.5);
  const id = useMealDraftStore.getState().createDraft('user', input, { success: true, data: confirmed });
  expect(useMealDraftStore.getState().drafts[id].originalAnalysis?.data?.regions[0].servingConfirmed).toBe(true);
});

it('flags overlapping duplicate regions and whole-dish/component conflicts for review', async () => {
  const box = { x: 0, y: 0, width: 80, height: 80 };
  const data = await analyze([region('Cheesecake', [food('cheesecake', 200, { representation: 'whole_dish', visible_count: 2 }), food('crust', 40)], { boundingBox: box }),
    region('Repeated cake', [food('cheesecake', 200, { representation: 'whole_dish' })], { boundingBox: box })]);
  expect(data.regions[0].reviewReasons?.join(' ')).toContain('whole dish');
  expect(data.regions[1].reviewReasons?.join(' ')).toContain('Overlapping');
  expect(hasPendingAnalysisReview(data)).toBe(true);
});

it('keeps uncertain egg identity reviewable and preserves legacy regions without changing their selection', async () => {
  const data = await analyze([region('Eggs', [food('small eggs', 20, { identity_uncertain: true, item_type: null })])]);
  expect(hasPendingAnalysisReview(data)).toBe(true);
  expect(data.ingredients[0].itemType).toBeNull();
});
