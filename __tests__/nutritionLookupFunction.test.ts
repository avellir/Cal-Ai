import { handleNutritionRequest, matchScore, toReference } from '../supabase/functions/nutrition-lookup/index';

const settings: Record<string, string> = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon', USDA_API_KEY: 'private-key' };
const food = (fdcId: number, description: string) => ({
  fdcId, description, foodNutrients: [
    { nutrient: { id: 1008, unitName: 'kcal' }, amount: 120 },
    { nutrient: { id: 1003, unitName: 'g' }, amount: 4 },
    { nutrient: { id: 1004, unitName: 'g' }, amount: 2 },
    { nutrient: { id: 1005, unitName: 'g' }, amount: 21 },
  ], foodPortions: [{ amount: 1, gramWeight: 85, modifier: 'piece', measureUnit: { name: 'undetermined' } }],
});
let sequence = 0;
function setup(responses: unknown[] = []) {
  const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'nutrition-user-' + ++sequence })));
  responses.forEach(body => fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body))));
  return { fetcher, deps: { env: (key: string) => settings[key], fetch: fetcher as typeof fetch } };
}
const request = (body: unknown) => new Request('https://test/nutrition-lookup', {
  method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(body),
});

it('requires authenticated users before any USDA request', async () => {
  const { fetcher, deps } = setup();
  expect((await handleNutritionRequest(new Request('https://test', { method: 'POST' }), deps)).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects expired sessions and supports CORS', async () => {
  const { fetcher, deps } = setup();
  fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 401 }));
  expect((await handleNutritionRequest(request({ mode: 'search', query: 'rice' }), deps)).status).toBe(401);
  expect((await handleNutritionRequest(new Request('https://test', { method: 'OPTIONS' }), deps)).status).toBe(204);
});
it('searches live USDA for a new food and fetches details for a close unambiguous match', async () => {
  const record = food(123456, 'Buckwheat cooked');
  const { fetcher, deps } = setup([{ foods: [record] }, record]);
  const response = await handleNutritionRequest(request({ mode: 'batch', queries: ['cooked buckwheat', 'cooked buckwheat'] }), deps);
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.results).toHaveLength(1);
  expect(body.results[0].match.id).toBe('usda:123456');
  expect(body.results[0].match.servings).toEqual([{ name: '1 piece', grams: 85 }]);
  const [url, options] = fetcher.mock.calls[1];
  expect(url).toContain('/foods/search');
  expect(JSON.parse(options.body).query).toBe('cooked buckwheat');
  expect(body.results[0].match.nutrients.calories).toBe(120);
  expect(JSON.stringify(body)).not.toContain('private-key');
});
it('retains candidate choices when recipes are ambiguous', async () => {
  const { deps } = setup([{ foods: [food(1, 'Mystery soup with chicken'), food(2, 'Mystery soup with beef')] }]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'mystery soup' }), deps)).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].candidates).toHaveLength(2);
  expect(body.results[0].candidates[0].recipeAverage).toBe(true);
});
it('gets reviewed IDs from USDA rather than hardcoded nutrient values', async () => {
  const { fetcher, deps } = setup([food(170250, 'Snacks, rice cakes, brown rice, plain, unsalted')]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'rice crispbread' }), deps)).json();
  expect(fetcher.mock.calls[1][0]).toContain('/food/170250?');
  expect(body.results[0].match.nutrients.calories).toBe(120);
});
it('does not invent missing nutrients or substitute raw for cooked foods', () => {
  const partial = food(3, 'Food');
  partial.foodNutrients.pop();
  expect(toReference(partial)).toBeNull();
  expect(matchScore('cooked rice', 'Rice raw')).toBe(0);
  expect(matchScore('tomato sauce', 'Tomatoes raw')).toBe(0);
  expect(matchScore('chicken', 'Soup chicken')).toBe(0);
  expect(matchScore('rice cake', 'Rice cooked')).toBe(0);
});
it('supports search payload nutrients and preserves confirmed zeros', () => {
  const result = toReference({ fdcId: 4, description: 'Water', foodNutrients: [
    { nutrientId: 1008, unitName: 'KCAL', value: 0 },
    { nutrientId: 1003, unitName: 'G', value: 0 },
    { nutrientId: 1004, unitName: 'G', value: 0 },
    { nutrientId: 1005, unitName: 'G', value: 0 },
  ] });
  expect(result?.nutrients).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
});
it.each([
  { mode: 'batch', queries: Array(61).fill('food') },
  { mode: 'search', query: '' },
  { mode: 'details', id: 'https://untrusted.example' },
  { mode: 'arbitrary' },
])('bounds request %j before contacting USDA', async body => {
  const { fetcher, deps } = setup();
  expect((await handleNutritionRequest(request(body), deps)).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('bounds streamed bodies and refuses invalid JSON', async () => {
  const { deps } = setup();
  expect((await handleNutritionRequest(request({ query: 'x'.repeat(16_001) }), deps)).status).toBe(413);
  const second = setup();
  const invalid = new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: '{' });
  expect((await handleNutritionRequest(invalid, second.deps)).status).toBe(400);
});
it('keeps foods unresolved during provider failure without leaking upstream diagnostics', async () => {
  const { fetcher, deps } = setup();
  fetcher.mockResolvedValueOnce(new Response('private provider error', { status: 429 }));
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'new unavailable food' }), deps)).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].reason).toContain('unavailable');
  expect(JSON.stringify(body)).not.toContain('private provider error');
});
it('returns explicit setup status when USDA is not configured', async () => {
  const { deps } = setup();
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'new unconfigured food' }), {
    ...deps, env: name => name === 'USDA_API_KEY' ? undefined : settings[name],
  })).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].reason).toContain('not configured');
});
it('caches successful lookups rather than repeating provider calls', async () => {
  const record = food(42, 'Millet cooked');
  const { deps } = setup([{ foods: [record] }, record]);
  await handleNutritionRequest(request({ mode: 'search', query: 'cooked millet' }), deps);
  const second = setup();
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'cooked millet' }), second.deps)).json();
  expect(body.results[0].match.id).toBe('usda:42');
  expect(second.fetcher).toHaveBeenCalledTimes(1);
});
