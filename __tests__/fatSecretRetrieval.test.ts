import { getFatSecretReference, searchFatSecret } from '../supabase/functions/nutrition-lookup/fatsecret';
import { accessToken, details, food, search } from './fixtures/fatsecret';

const settings: Record<string, string> = { FATSECRET_CLIENT_ID: 'retrieval-client', FATSECRET_CLIENT_SECRET: 'private-secret' };
const deps = (fetcher: typeof fetch) => ({ env: (name: string) => settings[name], fetch: fetcher });
const servingSummary = (id: number, name: string) => ({ ...food(id, name),
  food_description: 'Per 1 medium - Calories: 27kcal | Fat: 0.30g | Carbs: 5.85g | Protein: 1.35g' });

it('recovers a per-piece search result using its documented metric serving', async () => {
  const record = servingSummary(101, 'Tomatoes, raw');
  record.servings.serving = [{ ...record.servings.serving[0], metric_serving_amount: '150',
    calories: '27', protein: '1.35', carbohydrate: '5.85', fat: '0.30' }];
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(search([record])).mockResolvedValueOnce(details(record));
  const result = await searchFatSecret('raw tomato', deps(fetcher), new AbortController().signal);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual(expect.objectContaining({ id: 'fatsecret:101', basisAmount: 100, basisUnit: 'g' }));
  expect(result[0].nutrients.calories).toBeCloseTo(18);
  expect(result[0].nutrients.protein).toBeCloseTo(0.9);
});

it('recovers valid details when a search summary omits a nutrient', async () => {
  const record = { ...food(102, 'Strawberries'), food_description: 'Per 1 cup - Calories: 49kcal' };
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(search([record])).mockResolvedValueOnce(details(record));
  expect((await searchFatSecret('strawberries', deps(fetcher), new AbortController().signal))[0]?.id).toBe('fatsecret:102');
});

it('does not invent missing nutrients when the detailed record is also incomplete', async () => {
  const record = servingSummary(103, 'Tomatoes');
  const incomplete = { ...record, servings: { serving: { ...record.servings.serving[0], carbohydrate: undefined } } };
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(search([record]))
    .mockResolvedValueOnce(new Response(JSON.stringify({ food: incomplete })));
  expect(await searchFatSecret('tomato', deps(fetcher), new AbortController().signal)).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('preserves serving-only units when details provide no metric mass', async () => {
  const record = servingSummary(104, 'Broccoli cheese casserole');
  const serving = { ...record.servings.serving[0], metric_serving_amount: undefined, metric_serving_unit: undefined };
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(search([record]))
    .mockResolvedValueOnce(new Response(JSON.stringify({ food: { ...record, servings: { serving } } })));
  expect((await searchFatSecret('broccoli casserole', deps(fetcher), new AbortController().signal))[0]).toEqual(
    expect.objectContaining({ basisAmount: 1, basisUnit: 'serving', servings: [] }),
  );
});

it('deduplicates recovery calls and reuses details when the selected ID is loaded again', async () => {
  const record = servingSummary(105, 'Tomatoes');
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(search([record, record])).mockResolvedValueOnce(details(record));
  const transport = deps(fetcher);
  const signal = new AbortController().signal;
  expect(await searchFatSecret('tomatoes', transport, signal)).toHaveLength(1);
  expect((await getFatSecretReference('fatsecret:105', transport, signal))?.id).toBe('fatsecret:105');
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('bounds recovered detail requests and leaves brands out of photo references', async () => {
  const records = Array.from({ length: 20 }, (_, index) => servingSummary(200 + index, 'Tomatoes ' + index));
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([{ ...records[0], food_type: 'Brand' } as typeof records[number], ...records]);
    const id = Number(new URL(address).searchParams.get('food_id'));
    return details(food(id, 'Tomatoes'));
  });
  const result = await searchFatSecret('tomatoes', deps(fetcher), new AbortController().signal);
  expect(result.length).toBeGreaterThan(0);
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/food/v5'))).toHaveLength(6);
});

it('prioritizes the requested food before spending the recovery budget', async () => {
  const records = Array.from({ length: 12 }, (_, index) => servingSummary(300 + index, 'Unrelated casserole ' + index));
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([...records, servingSummary(399, 'Tomatoes')]);
    const id = Number(new URL(address).searchParams.get('food_id'));
    return details(food(id, id === 399 ? 'Tomatoes' : 'Unrelated casserole'));
  });
  const result = await searchFatSecret('raw tomato', deps(fetcher), new AbortController().signal);
  expect(result[0]?.id).toBe('fatsecret:399');
});

it('keeps detail caches isolated when credentials change', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(details(food(401, 'Tomatoes', 18)))
    .mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(details(food(401, 'Tomatoes', 19)));
  const signal = new AbortController().signal;
  expect((await getFatSecretReference('fatsecret:401', deps(fetcher), signal))?.nutrients.calories).toBe(18);
  const changed = { env: (name: string) => name === 'FATSECRET_CLIENT_SECRET' ? 'changed-secret' : settings[name], fetch: fetcher };
  expect((await getFatSecretReference('fatsecret:401', changed, signal))?.nutrients.calories).toBe(19);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
