import { supabase } from '@/lib/supabase';
import { isNutritionLookupFailure, lookupFoodNutrition } from '@/services/nutritionLookup';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, functions: { invoke: jest.fn() } } }));
const invoke = supabase.functions.invoke as jest.Mock;
beforeEach(() => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'user-token' } } });
  invoke.mockReset();
});

it('preserves ordered duplicate queries, healthy matches, candidates and per-item failures from a partial resolve', async () => {
  const reference = { id: 'fatsecret:1', name: 'Apple', source: 'fatsecret', basisAmount: 100, basisUnit: 'g', servings: [],
    nutrients: { calories: 52, protein: 0, carbs: 14, fat: 0 } };
  const failure = { stage: 'details', code: 'temporary', retryable: true, attempts: 3 };
  invoke.mockResolvedValue({ error: null, data: { partial: true, results: [
    { query: 'apple', match: reference, candidates: [reference] },
    { query: 'apple', match: null, candidates: [reference], reason: 'Please try again shortly.', failure },
  ] } });
  const results = await lookupFoodNutrition(['apple', 'apple'], [{}, {}]);
  expect(results[0].match).toEqual(reference);
  expect(results[0].failure).toBeUndefined();
  expect(results[1]).toEqual(expect.objectContaining({ match: null, candidates: [reference], failure, reason: 'Please try again shortly.' }));
});

it.each([
  { stage: 'credentials', code: 'temporary', retryable: true, attempts: 1 },
  { stage: 'search', code: 'private_debug', retryable: true, attempts: 1 },
  { stage: 'search', code: 'temporary', retryable: 'yes', attempts: 1 },
  { stage: 'search', code: 'temporary', retryable: true, attempts: 4 },
])('rejects malformed failure metadata: %j', failure => expect(isNutritionLookupFailure(failure)).toBe(false));
