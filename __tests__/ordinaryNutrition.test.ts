import { requiresIdentityConfirmation as clientPolicy } from '@/lib/nutritionIdentity';
import { requiresIdentityConfirmation as serverPolicy, resolveAutomatically, compatibleCandidate } from '../supabase/functions/nutrition-lookup/index';
import { resolveIngredient } from '@/services/analysisNutrition';
import { initializeAnalysisScope, hasPendingAnalysisReview } from '@/services/analysisScope';
import { food, search, details, accessToken } from './fixtures/fatsecret';
import type { NutritionFoodContext, NutritionReference } from '@/lib/nutrition-types';

it.each<[string, NutritionFoodContext, boolean]>([
  ['cheesecake', { foodName: 'cheesecake', nutritionIdentityKnown: false }, false],
  ['powdered sugar', { foodName: 'powdered sugar', nutritionIdentityKnown: false }, false],
  ['fresh herbs', { foodName: 'fresh herbs', identityUncertain: true, identityAlternatives: ['basil', 'oregano'] }, false],
  ['sauce', { foodName: 'sauce', dishName: 'Salmon in creamy sauce' }, false],
  ['sauce', { foodName: 'sauce' }, true],
  ['cubed protein', { foodName: 'tofu', identityAlternatives: ['chicken'] }, true],
  ['egg', { foodName: 'egg', identityUncertain: true, identityAlternatives: ['quail egg', 'chicken egg'] }, true],
  ['dessert', { foodName: 'cheesecake', identityAlternatives: ['custard tart'] }, true],
  ['ice cream', { foodName: 'ice cream', identityAlternatives: ['strawberry ice cream', 'vanilla ice cream'] }, false],
  ['cocktail', { foodName: 'cocktail', nutritionIdentityKnown: false }, true],
])('keeps client/server identity policy aligned for %s', (query, context, required) => {
  expect(clientPolicy(query, context)).toBe(required);
  expect(serverPolicy(query, context)).toBe(required);
});

it('resolves ordinary cheesecake despite an unknown exact recipe, with documented approximate nutrition', async () => {
  const record = food(105, 'Cheesecake, commercially prepared', 320);
  const fetcher = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes('/connect/token')) return accessToken();
    if (String(url).includes('/foods/search')) return search([record]);
    if (String(url).includes('/responses')) {
      const schema = JSON.parse(String(options?.body)).text.format.schema;
      expect(schema.properties.selections.items.anyOf[0].properties.id.enum).toEqual([null, 'fatsecret:105']);
      return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ selections: [
      { index: 0, id: 'fatsecret:105', quality: 'exact', reason: 'Ordinary compatible cheesecake.', alternativeQuery: '' },
      ] }) }] }] }));
    }
    return details(record);
  });
  const env: Record<string, string> = { FATSECRET_CLIENT_ID: 'client', FATSECRET_CLIENT_SECRET: 'private', SUPABASE_URL: 'https://ordinary-test.supabase.co',
    AZURE_OPENAI_BASE_URL: 'https://test.openai.azure.com/openai/v1', AZURE_OPENAI_API_KEY: 'private', AZURE_OPENAI_DEPLOYMENT: 'selector' };
  const results = await resolveAutomatically(['cheesecake'], [{ foodName: 'cheesecake', representation: 'whole_dish', nutritionIdentityKnown: false }],
    { env: name => env[name], fetch: fetcher }, new AbortController().signal);
  expect(results[0].match?.matchQuality).toBe('approximate');
  expect(results[0].match?.nutrients.calories).toBe(320);
  const ingredient = resolveIngredient({ name: 'cheesecake', foodName: 'cheesecake', representation: 'whole_dish',
    quantity: 180, unit: 'g', confidence: 90, nutritionIdentityKnown: false, regionIndex: 0 }, results[0].match as NutritionReference);
  expect(ingredient.scaledNutrition.calories).toBe(576);
  const data = initializeAnalysisScope({ totalNutrition: ingredient.scaledNutrition, ingredients: [ingredient], confidence: 90,
    regions: [{ description: 'Cake', scope: 'main', confidence: 90 }] });
  expect(hasPendingAnalysisReview(data)).toBe(false);
});

it('permits same-family ordinary proxies but preserves preparation, texture and whole-dish boundaries', () => {
  expect(compatibleCandidate('ice cream', 'Ice cream, vanilla')).toBe(true);
  expect(compatibleCandidate('grated cheese', 'Cheese, parmesan')).toBe(true);
  expect(compatibleCandidate('grated cheese', 'Cheese, cottage')).toBe(false);
  expect(compatibleCandidate('strawberry ice cream', 'Ice cream, vanilla')).toBe(false);
  expect(compatibleCandidate('penne with tomato sauce', 'Sauce, tomato', { representation: 'whole_dish' })).toBe(false);
});

it('keeps visible sauce-family context consistent from selection to scaling and review', () => {
  const reference: NutritionReference = { id: 'fatsecret:cream', name: 'Sauce, cream', source: 'fatsecret', basisAmount: 100, basisUnit: 'g',
    nutrients: { calories: 150, protein: 2, carbs: 5, fat: 13 }, servings: [], matchQuality: 'approximate' };
  const ingredient = resolveIngredient({ name: 'sauce', foodName: 'sauce', quantity: 100, unit: 'g', confidence: 80,
    regionIndex: 0, quantitySource: 'photo', nutritionIdentityKnown: false }, reference, 'Salmon in creamy sauce');
  const data = initializeAnalysisScope({ totalNutrition: ingredient.scaledNutrition, ingredients: [ingredient], confidence: 90,
    regions: [{ description: 'Fish', dishName: 'Salmon in creamy sauce', scope: 'main', confidence: 90 }] });
  expect(hasPendingAnalysisReview(data)).toBe(false);
  expect(ingredient.nutrition.reference?.matchQuality).toBe('approximate');
});

it('does not mistake a separate fresh herb for a duplicated cake component', () => {
  const reference: NutritionReference = { id: 'fatsecret:cake', name: 'Cheesecake, plain', source: 'fatsecret', basisAmount: 100, basisUnit: 'g',
    nutrients: { calories: 300, protein: 5, carbs: 25, fat: 20 }, servings: [] };
  const whole = resolveIngredient({ name: 'cheesecake', quantity: 180, unit: 'g', confidence: 90, regionIndex: 0, representation: 'whole_dish' }, reference);
  const herb = resolveIngredient({ name: 'mint', quantity: 3, unit: 'g', confidence: 90, regionIndex: 0, representation: 'component' }, { ...reference, name: 'Spearmint fresh' });
  const data = initializeAnalysisScope({ ingredients: [whole, herb], totalNutrition: whole.scaledNutrition, confidence: 90,
    regions: [{ description: 'Cake', confidence: 90 }] });
  expect(data.regions[0].reviewReasons).toEqual([]);
  expect(compatibleCandidate('mint', 'Candies, chocolate mint')).toBe(false);
  expect(compatibleCandidate('mint', 'Apple, raw')).toBe(false);
  expect(compatibleCandidate('mint', 'Spearmint, fresh')).toBe(true);
  expect(compatibleCandidate('cherry tomato', 'Cherries, raw')).toBe(false);
  expect(compatibleCandidate('tomato sauce', 'Tomatoes, cooked')).toBe(false);
  expect(compatibleCandidate('tomato sauce', 'Tomato products, canned, sauce')).toBe(true);
});
